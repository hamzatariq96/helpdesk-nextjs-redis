import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { CommentForm, TicketControls } from "@/components/TicketActions";
import { requireUser } from "@/lib/auth";
import { NotFoundError } from "@/lib/errors";
import { formatDuration, isOverdue, SLA_HOURS } from "@/lib/sla";
import { getTicket } from "@/repositories/tickets";
import { listAssignableUsers } from "@/repositories/users";

export default async function TicketPage({ params }: { params: { id: string } }) {
  await requireUser();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [data, people] = await Promise.all([
    getTicket(id).catch((error) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }),
    listAssignableUsers(),
  ]);
  const { ticket, comments } = data;
  const now = new Date();
  const age = now.getTime() - new Date(ticket.createdAt).getTime();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {isOverdue(ticket, now) && <span className="text-xs font-medium text-red-600">Past {SLA_HOURS[ticket.priority]}h SLA</span>}
          </div>
          <h1 className="text-2xl font-semibold">#{ticket.id} {ticket.title}</h1>
          <p className="text-sm text-slate-500">
            Opened by {ticket.createdBy.name} · {formatDuration(age)} ago
            {ticket.resolvedAt &&
              ` · resolved in ${formatDuration(new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime())}`}
          </p>
          {ticket.description && <p className="whitespace-pre-wrap text-slate-700">{ticket.description}</p>}
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold">Conversation ({comments.length})</h2>
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-slate-50 p-3">
                <p className="mb-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{c.author.name}</span> · <LocalTime iso={c.createdAt} />
                </p>
                <p className="whitespace-pre-wrap text-sm">{c.body}</p>
              </li>
            ))}
          </ul>
          <CommentForm ticketId={ticket.id} />
        </section>
      </div>

      <aside className="card h-fit">
        <TicketControls ticket={ticket} people={people} />
      </aside>
    </div>
  );
}
