import { CacheKeys, cached } from "@/lib/cache";
import { pool } from "@/lib/db";
import { slaIntervalSql } from "@/lib/sla";
import type { Priority, Status } from "@/lib/types";

export interface DashboardStats {
  byStatus: Record<Status, number>;
  openByPriority: Record<Priority, number>;
  unassigned: number;
  overdue: number;
  createdToday: number;
  generatedAt: string;
}

export interface AgentReportRow {
  id: number;
  name: string;
  openAssigned: number;
  resolvedLast30Days: number;
  avgResolutionHours: number | null;
}

export interface Report {
  agents: AgentReportRow[];
  createdPerDay: { day: string; count: number }[];
  generatedAt: string;
}

const DASHBOARD_TTL_SECONDS = 30;
const REPORT_TTL_SECONDS = 120;

export function getDashboardStats(): Promise<DashboardStats> {
  return cached(CacheKeys.dashboard, DASHBOARD_TTL_SECONDS, async () => {
    // One pass over tickets using FILTER, instead of a query per number on the page.
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')                                   AS open,
        COUNT(*) FILTER (WHERE status = 'in_progress')                            AS in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved')                               AS resolved,
        COUNT(*) FILTER (WHERE status = 'closed')                                 AS closed,
        COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND priority = 'low')    AS p_low,
        COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND priority = 'medium') AS p_medium,
        COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND priority = 'high')   AS p_high,
        COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND priority = 'urgent') AS p_urgent,
        COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND assignee_id IS NULL) AS unassigned,
        COUNT(*) FILTER (WHERE status IN ('open','in_progress')
                           AND now() - created_at > ${slaIntervalSql()})           AS overdue,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))            AS created_today
      FROM tickets`);
    const r = rows[0];
    const n = (value: string) => Number(value);
    return {
      byStatus: { open: n(r.open), in_progress: n(r.in_progress), resolved: n(r.resolved), closed: n(r.closed) },
      openByPriority: { low: n(r.p_low), medium: n(r.p_medium), high: n(r.p_high), urgent: n(r.p_urgent) },
      unassigned: n(r.unassigned),
      overdue: n(r.overdue),
      createdToday: n(r.created_today),
      generatedAt: new Date().toISOString(),
    };
  });
}

export function getReport(): Promise<Report> {
  return cached(CacheKeys.report, REPORT_TTL_SECONDS, async () => {
    const agents = await pool.query(`
      SELECT u.id, u.name,
             COUNT(t.id) FILTER (WHERE t.status IN ('open','in_progress'))                     AS open_assigned,
             COUNT(t.id) FILTER (WHERE t.resolved_at >= now() - interval '30 days')            AS resolved_30d,
             AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)
               FILTER (WHERE t.resolved_at >= now() - interval '30 days')                      AS avg_hours
        FROM users u
        LEFT JOIN tickets t ON t.assignee_id = u.id
       GROUP BY u.id, u.name
       ORDER BY resolved_30d DESC, u.name`);

    const perDay = await pool.query(`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(t.id) AS count
        FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d(day)
        LEFT JOIN tickets t ON date_trunc('day', t.created_at) = d.day
       GROUP BY d.day
       ORDER BY d.day`);

    return {
      agents: agents.rows.map((row) => ({
        id: row.id,
        name: row.name,
        openAssigned: Number(row.open_assigned),
        resolvedLast30Days: Number(row.resolved_30d),
        avgResolutionHours: row.avg_hours === null ? null : Math.round(Number(row.avg_hours) * 10) / 10,
      })),
      createdPerDay: perDay.rows.map((row) => ({ day: row.day, count: Number(row.count) })),
      generatedAt: new Date().toISOString(),
    };
  });
}
