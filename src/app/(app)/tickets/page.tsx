import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { label, PriorityBadge, StatusBadge } from "@/components/Badges";
import { requireUser } from "@/lib/auth";
import { isOverdue } from "@/lib/sla";
import { STATUSES } from "@/lib/types";
import { parseTicketFilters } from "@/lib/validation";
import { listTickets } from "@/repositories/tickets";
import { listAssignableUsers } from "@/repositories/users";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TicketsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = parseTicketFilters(searchParams);
  const [{ tickets, total, page, pageCount }, people] = await Promise.all([
    listTickets(filters, user.id),
    listAssignableUsers(),
  ]);
  const now = new Date();

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.assignee) params.set("assignee", String(filters.assignee));
    if (filters.q) params.set("q", filters.q);
    params.set("page", String(target));
    return `/tickets?${params}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <Link href="/tickets/new" className="btn">New ticket</Link>
      </div>

      <form className="card grid gap-3 sm:grid-cols-4" method="get">
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Search titles" className="input sm:col-span-2" />
        <select name="status" defaultValue={filters.status ?? ""} className="input">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">{label(s)}</option>
          ))}
        </select>
        <select name="assignee" defaultValue={filters.assignee ? String(filters.assignee) : ""} className="input">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-4">
          <button className="btn" type="submit">Apply</button>
          <Link href="/tickets" className="btn-secondary">Reset</Link>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Ticket</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Assignee</th>
              <th className="px-4 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/tickets/${t.id}`} className="font-medium hover:text-indigo-700">
                    #{t.id} {t.title}
                  </Link>
                  {isOverdue(t, now) && <span className="ml-2 text-xs font-medium text-red-600">past SLA</span>}
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-2.5"><PriorityBadge priority={t.priority} /></td>
                <td className="px-4 py-2.5 text-slate-600">{t.assignee?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
                <td className="px-4 py-2.5 text-slate-500"><LocalTime iso={t.updatedAt} /></td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No tickets match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{total} ticket{total === 1 ? "" : "s"}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn-secondary">Previous</Link>}
          <span className="px-2 py-2">Page {page} of {pageCount}</span>
          {page < pageCount && <Link href={pageHref(page + 1)} className="btn-secondary">Next</Link>}
        </div>
      </div>
    </div>
  );
}
