import { requireUser } from "@/lib/auth";
import { LocalTime } from "@/components/LocalTime";
import { getReport } from "@/repositories/stats";

export default async function ReportsPage() {
  await requireUser("admin");
  const report = await getReport();
  const maxPerDay = Math.max(1, ...report.createdPerDay.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-xs text-slate-400">Cached in Redis · generated <LocalTime iso={report.generatedAt} timeOnly /></p>
      </div>

      <section className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-5 font-semibold">Team workload</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-2 font-medium">Person</th>
              <th className="px-5 py-2 text-right font-medium">Open assigned</th>
              <th className="px-5 py-2 text-right font-medium">Resolved (30 days)</th>
              <th className="px-5 py-2 text-right font-medium">Avg. time to resolve</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.agents.map((a) => (
              <tr key={a.id}>
                <td className="px-5 py-2.5 font-medium">{a.name}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{a.openAssigned}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{a.resolvedLast30Days}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{a.avgResolutionHours === null ? "—" : `${a.avgResolutionHours}h`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">Tickets created, last 14 days</h2>
        <div className="flex h-48 items-end gap-2">
          {report.createdPerDay.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.count}`}>
              <span className="text-xs tabular-nums text-slate-500">{d.count}</span>
              <div className="w-full rounded-t bg-indigo-500" style={{ height: `${(d.count / maxPerDay) * 140}px`, minHeight: d.count ? 4 : 0 }} />
              <span className="text-[10px] text-slate-400">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
