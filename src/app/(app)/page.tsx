import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { requireUser } from "@/lib/auth";
import { formatDuration, isOverdue } from "@/lib/sla";
import { PRIORITIES } from "@/lib/types";
import { getDashboardStats } from "@/repositories/stats";
import { listTickets } from "@/repositories/tickets";

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, mine] = await Promise.all([
    getDashboardStats(),
    listTickets({ assignee: "me", status: undefined, page: 1 }, user.id),
  ]);
  const active = mine.tickets.filter((t) => t.status === "open" || t.status === "in_progress").slice(0, 6);
  const now = new Date();

  const cards = [
    { label: "Open", value: stats.byStatus.open, href: "/tickets?status=open" },
    { label: "In progress", value: stats.byStatus.in_progress, href: "/tickets?status=in_progress" },
    { label: "Unassigned", value: stats.unassigned, href: "/tickets?assignee=unassigned" },
    { label: "Past SLA", value: stats.overdue, href: "/tickets?status=open", alert: stats.overdue > 0 },
    { label: "Resolved", value: stats.byStatus.resolved, href: "/tickets?status=resolved" },
    { label: "Created today", value: stats.createdToday, href: "/tickets" },
  ];
  const openTotal = PRIORITIES.reduce((sum, p) => sum + stats.openByPriority[p], 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-xs text-slate-400">Stats cached in Redis · generated <LocalTime iso={stats.generatedAt} timeOnly /></p>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card hover:border-indigo-300">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-1 text-3xl font-semibold ${card.alert ? "text-red-600" : ""}`}>{card.value}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">My active tickets</h2>
          {active.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing assigned to you right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {active.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <Link href={`/tickets/${t.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-indigo-700">
                    #{t.id} {t.title}
                  </Link>
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                  <span className={`text-xs ${isOverdue(t, now) ? "font-medium text-red-600" : "text-slate-400"}`}>
                    {formatDuration(now.getTime() - new Date(t.createdAt).getTime())} old
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Open by priority</h2>
          <ul className="space-y-3">
            {[...PRIORITIES].reverse().map((p) => {
              const count = stats.openByPriority[p];
              const width = openTotal ? Math.round((count / openTotal) * 100) : 0;
              return (
                <li key={p}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="capitalize">{p}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
