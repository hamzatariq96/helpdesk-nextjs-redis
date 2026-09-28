import { CacheKeys } from "@/lib/cache";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { TICKET_CHANNEL } from "@/lib/events";
import { createSubscriber, redis } from "@/lib/redis";
import type { SessionUser, TicketEvent } from "@/lib/types";
import { createTicketSchema } from "@/lib/validation";
import { getDashboardStats, getReport } from "@/repositories/stats";
import { addComment, createTicket, getTicket, listTickets, PAGE_SIZE, updateTicket } from "@/repositories/tickets";
import { backdateTicket, makeUser, useCleanState } from "../helpers";

useCleanState();

let admin: SessionUser;
let agent: SessionUser;

beforeEach(async () => {
  admin = await makeUser("Sara Khan", "admin");
  agent = await makeUser("Ali Raza", "agent");
});

const newTicket = (overrides: Partial<Parameters<typeof createTicketSchema.parse>[0]> = {}) =>
  createTicketSchema.parse({ title: "Cannot log in", ...overrides });

describe("creating and reading tickets", () => {
  it("creates a ticket with its creator and assignee", async () => {
    const ticket = await createTicket(newTicket({ priority: "high", assigneeId: agent.id }), admin);

    expect(ticket).toMatchObject({
      title: "Cannot log in",
      status: "open",
      priority: "high",
      createdBy: { id: admin.id, name: "Sara Khan" },
      assignee: { id: agent.id, name: "Ali Raza" },
      resolvedAt: null,
    });
  });

  it("returns comments in the order they were written", async () => {
    const ticket = await createTicket(newTicket(), admin);
    await addComment(ticket.id, "Looking into it", agent);
    await addComment(ticket.id, "Fixed, please retry", agent);

    const { comments } = await getTicket(ticket.id);

    expect(comments.map((c) => c.body)).toEqual(["Looking into it", "Fixed, please retry"]);
    expect(comments[0].author).toEqual({ id: agent.id, name: "Ali Raza" });
  });

  it("throws NotFound for a missing ticket", async () => {
    await expect(getTicket(999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(addComment(999, "hello", agent)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listing and filtering", () => {
  beforeEach(async () => {
    await createTicket(newTicket({ title: "VPN drops every hour", assigneeId: agent.id }), admin);
    const printer = await createTicket(newTicket({ title: "Printer shows 50% toner" }), admin);
    await createTicket(newTicket({ title: "Email bounce from finance", assigneeId: admin.id }), admin);
    await updateTicket(printer.id, { status: "resolved" }, admin);
  });

  it("shows the most recently updated tickets first", async () => {
    const { tickets, total } = await listTickets({ page: 1 }, admin.id);
    expect(total).toBe(3);
    expect(tickets[0].title).toBe("Printer shows 50% toner");
  });

  it("filters by status", async () => {
    const { tickets } = await listTickets({ status: "resolved", page: 1 }, admin.id);
    expect(tickets.map((t) => t.title)).toEqual(["Printer shows 50% toner"]);
  });

  it("filters by 'me', 'unassigned' and a specific assignee", async () => {
    const mine = await listTickets({ assignee: "me", page: 1 }, agent.id);
    const unassigned = await listTickets({ assignee: "unassigned", page: 1 }, agent.id);
    const admins = await listTickets({ assignee: admin.id, page: 1 }, agent.id);

    expect(mine.tickets.map((t) => t.title)).toEqual(["VPN drops every hour"]);
    expect(unassigned.tickets.map((t) => t.title)).toEqual(["Printer shows 50% toner"]);
    expect(admins.tickets.map((t) => t.title)).toEqual(["Email bounce from finance"]);
  });

  it("searches titles case-insensitively and treats % literally", async () => {
    expect((await listTickets({ q: "vpn", page: 1 }, admin.id)).tickets).toHaveLength(1);
    expect((await listTickets({ q: "50%", page: 1 }, admin.id)).tickets).toHaveLength(1);
    expect((await listTickets({ q: "%", page: 1 }, admin.id)).tickets).toHaveLength(1);
  });

  it("paginates", async () => {
    for (let i = 0; i < PAGE_SIZE; i++) await createTicket(newTicket({ title: `Bulk ticket ${i}` }), admin);

    const page1 = await listTickets({ page: 1 }, admin.id);
    const page2 = await listTickets({ page: 2 }, admin.id);

    expect(page1.tickets).toHaveLength(PAGE_SIZE);
    expect(page2.tickets).toHaveLength(3);
    expect(page1.pageCount).toBe(2);
  });
});

describe("updating tickets", () => {
  it("sets resolved_at when resolved and clears it when reopened", async () => {
    const ticket = await createTicket(newTicket(), admin);

    const resolved = await updateTicket(ticket.id, { status: "resolved" }, agent);
    const reopened = await updateTicket(ticket.id, { status: "in_progress" }, agent);

    expect(resolved.resolvedAt).not.toBeNull();
    expect(reopened.resolvedAt).toBeNull();
  });

  it("keeps the original resolved_at when a resolved ticket is closed", async () => {
    const ticket = await createTicket(newTicket(), admin);
    const resolved = await updateTicket(ticket.id, { status: "resolved" }, agent);

    const closed = await updateTicket(ticket.id, { status: "closed" }, agent);

    expect(closed.resolvedAt).toBe(resolved.resolvedAt);
  });

  it("rejects transitions that aren't allowed", async () => {
    const ticket = await createTicket(newTicket(), admin);
    await updateTicket(ticket.id, { status: "closed" }, agent);

    await expect(updateTicket(ticket.id, { status: "resolved" }, agent)).rejects.toBeInstanceOf(ConflictError);
  });

  it("reassigns and unassigns", async () => {
    const ticket = await createTicket(newTicket(), admin);

    expect((await updateTicket(ticket.id, { assigneeId: agent.id }, admin)).assignee?.id).toBe(agent.id);
    expect((await updateTicket(ticket.id, { assigneeId: null }, admin)).assignee).toBeNull();
  });
});

describe("real-time events", () => {
  it("publishes an event to Redis for every write", async () => {
    const subscriber = createSubscriber();
    const received: TicketEvent[] = [];
    await subscriber.subscribe(TICKET_CHANNEL);
    subscriber.on("message", (_channel, message) => received.push(JSON.parse(message)));

    const ticket = await createTicket(newTicket(), admin);
    await updateTicket(ticket.id, { status: "in_progress" }, agent);
    await addComment(ticket.id, "On it", agent);
    await redis.ping(); // messages published before this round trip have been delivered by now
    await subscriber.ping();

    expect(received.map((e) => [e.type, e.ticketId, e.actor])).toEqual([
      ["created", ticket.id, "Sara Khan"],
      ["updated", ticket.id, "Ali Raza"],
      ["commented", ticket.id, "Ali Raza"],
    ]);
    subscriber.disconnect();
  });
});

describe("dashboard stats and reports", () => {
  it("counts tickets by status, priority, assignment and SLA", async () => {
    const urgent = await createTicket(newTicket({ priority: "urgent" }), admin);
    await createTicket(newTicket({ priority: "low", assigneeId: agent.id }), admin);
    const done = await createTicket(newTicket(), admin);
    await updateTicket(done.id, { status: "resolved" }, agent);
    await backdateTicket(urgent.id, 5); // urgent SLA is 4h

    const stats = await getDashboardStats();

    expect(stats.byStatus).toEqual({ open: 2, in_progress: 0, resolved: 1, closed: 0 });
    expect(stats.openByPriority).toEqual({ low: 1, medium: 0, high: 0, urgent: 1 });
    expect(stats.unassigned).toBe(1);
    expect(stats.overdue).toBe(1);
  });

  it("serves stats from the cache until a ticket changes", async () => {
    await createTicket(newTicket(), admin);
    const first = await getDashboardStats();
    expect(await redis.exists(`cache:${CacheKeys.dashboard}`)).toBe(1);

    // A direct DB change bypasses invalidation, so the cached value is still served.
    await redis.set(`cache:${CacheKeys.dashboard}`, JSON.stringify({ ...first, unassigned: 42 }), "EX", 30);
    expect((await getDashboardStats()).unassigned).toBe(42);

    // A write through the repository clears the cache.
    await createTicket(newTicket(), admin);
    expect(await redis.exists(`cache:${CacheKeys.dashboard}`)).toBe(0);
    expect((await getDashboardStats()).byStatus.open).toBe(2);
  });

  it("reports per-agent workload and 14 days of ticket volume", async () => {
    const t1 = await createTicket(newTicket({ assigneeId: agent.id }), admin);
    await createTicket(newTicket({ assigneeId: agent.id }), admin);
    await backdateTicket(t1.id, 10);
    await updateTicket(t1.id, { status: "resolved" }, agent);

    const report = await getReport();
    const ali = report.agents.find((a) => a.name === "Ali Raza")!;

    expect(ali.openAssigned).toBe(1);
    expect(ali.resolvedLast30Days).toBe(1);
    expect(ali.avgResolutionHours).toBeCloseTo(10, 0);
    expect(report.createdPerDay).toHaveLength(14);
    expect(report.createdPerDay.reduce((sum, d) => sum + d.count, 0)).toBe(2);
  });
});
