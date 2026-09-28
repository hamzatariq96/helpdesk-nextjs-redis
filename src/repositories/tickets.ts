import type { PoolClient } from "pg";
import { CacheKeys, invalidate } from "@/lib/cache";
import { pool, withTransaction } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { publishTicketEvent } from "@/lib/events";
import { canTransition } from "@/lib/sla";
import type { SessionUser, Status, Ticket, TicketComment, TicketEvent } from "@/lib/types";
import type { CreateTicketInput, TicketFilters, UpdateTicketInput } from "@/lib/validation";

export const PAGE_SIZE = 20;

const TICKET_SELECT = `
  SELECT t.id, t.title, t.description, t.status, t.priority,
         t.created_at, t.updated_at, t.resolved_at,
         c.id AS creator_id, c.name AS creator_name,
         a.id AS assignee_id, a.name AS assignee_name
    FROM tickets t
    JOIN users c ON c.id = t.created_by
    LEFT JOIN users a ON a.id = t.assignee_id`;

interface TicketRow {
  id: number;
  title: string;
  description: string;
  status: Ticket["status"];
  priority: Ticket["priority"];
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  creator_id: number;
  creator_name: string;
  assignee_id: number | null;
  assignee_name: string | null;
}

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdBy: { id: row.creator_id, name: row.creator_name },
    assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name ?? "" } : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  };
}

/** Escapes LIKE wildcards so a search for "50%" matches the literal text. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export async function listTickets(
  filters: TicketFilters,
  currentUserId: number,
): Promise<{ tickets: Ticket[]; total: number; page: number; pageCount: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const param = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.status) where.push(`t.status = ${param(filters.status)}`);
  if (filters.assignee === "me") where.push(`t.assignee_id = ${param(currentUserId)}`);
  else if (filters.assignee === "unassigned") where.push("t.assignee_id IS NULL");
  else if (typeof filters.assignee === "number") where.push(`t.assignee_id = ${param(filters.assignee)}`);
  if (filters.q) where.push(`t.title ILIKE ${param(likePattern(filters.q))}`);

  const page = filters.page ?? 1;
  const sql = `
    SELECT *, COUNT(*) OVER() AS total FROM (${TICKET_SELECT}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ) t
    ORDER BY t.updated_at DESC, t.id DESC
    LIMIT ${param(PAGE_SIZE)} OFFSET ${param((page - 1) * PAGE_SIZE)}`;

  const { rows } = await pool.query<TicketRow & { total: string }>(sql, params);
  const total = rows.length ? Number(rows[0].total) : 0;
  return {
    tickets: rows.map(toTicket),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

async function fetchTicket(client: PoolClient | typeof pool, id: number): Promise<Ticket> {
  const { rows } = await client.query<TicketRow>(`${TICKET_SELECT} WHERE t.id = $1`, [id]);
  if (!rows[0]) throw new NotFoundError(`Ticket #${id} not found`);
  return toTicket(rows[0]);
}

export async function getTicket(id: number): Promise<{ ticket: Ticket; comments: TicketComment[] }> {
  const ticket = await fetchTicket(pool, id);
  const { rows } = await pool.query(
    `SELECT tc.id, tc.body, tc.created_at, u.id AS author_id, u.name AS author_name
       FROM ticket_comments tc JOIN users u ON u.id = tc.author_id
      WHERE tc.ticket_id = $1
      ORDER BY tc.created_at, tc.id`,
    [id],
  );
  const comments = rows.map((row) => ({
    id: row.id,
    body: row.body,
    author: { id: row.author_id, name: row.author_name },
    createdAt: row.created_at.toISOString(),
  }));
  return { ticket, comments };
}

/** Every write goes through here: drop cached aggregates, then tell live clients. */
async function afterWrite(type: TicketEvent["type"], ticket: Ticket, actor: SessionUser): Promise<void> {
  await invalidate(CacheKeys.dashboard, CacheKeys.report);
  await publishTicketEvent({
    type,
    ticketId: ticket.id,
    title: ticket.title,
    actor: actor.name,
    at: new Date().toISOString(),
  });
}

export async function createTicket(input: CreateTicketInput, actor: SessionUser): Promise<Ticket> {
  const ticket = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO tickets (title, description, priority, created_by, assignee_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.title, input.description, input.priority, actor.id, input.assigneeId],
    );
    return fetchTicket(client, rows[0].id);
  });
  await afterWrite("created", ticket, actor);
  return ticket;
}

const isDone = (status: Status) => status === "resolved" || status === "closed";

export async function updateTicket(id: number, patch: UpdateTicketInput, actor: SessionUser): Promise<Ticket> {
  const ticket = await withTransaction(async (client) => {
    // Lock the row so two agents changing status at once can't both pass the transition check.
    const { rows } = await client.query(`SELECT status FROM tickets WHERE id = $1 FOR UPDATE`, [id]);
    if (!rows[0]) throw new NotFoundError(`Ticket #${id} not found`);
    const current: Status = rows[0].status;

    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (patch.status && patch.status !== current) {
      if (!canTransition(current, patch.status)) {
        throw new ConflictError(`Can't move a ${current.replace("_", " ")} ticket to ${patch.status.replace("_", " ")}`);
      }
      sets.push(`status = ${param(patch.status)}`);
      if (isDone(patch.status) && !isDone(current)) sets.push("resolved_at = now()");
      if (!isDone(patch.status) && isDone(current)) sets.push("resolved_at = NULL");
    }
    if (patch.priority) sets.push(`priority = ${param(patch.priority)}`);
    if (patch.assigneeId !== undefined) sets.push(`assignee_id = ${param(patch.assigneeId)}`);

    await client.query(`UPDATE tickets SET ${sets.join(", ")} WHERE id = ${param(id)}`, params);
    return fetchTicket(client, id);
  });
  await afterWrite("updated", ticket, actor);
  return ticket;
}

export async function addComment(ticketId: number, body: string, actor: SessionUser): Promise<TicketComment> {
  const { comment, ticket } = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO ticket_comments (ticket_id, author_id, body)
       SELECT id, $2, $3 FROM tickets WHERE id = $1
       RETURNING id, body, created_at`,
      [ticketId, actor.id, body],
    );
    if (!rows[0]) throw new NotFoundError(`Ticket #${ticketId} not found`);
    await client.query(`UPDATE tickets SET updated_at = now() WHERE id = $1`, [ticketId]);
    return {
      comment: {
        id: rows[0].id,
        body: rows[0].body,
        author: { id: actor.id, name: actor.name },
        createdAt: rows[0].created_at.toISOString(),
      },
      ticket: await fetchTicket(client, ticketId),
    };
  });
  await afterWrite("commented", ticket, actor);
  return comment;
}
