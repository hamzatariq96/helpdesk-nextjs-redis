import type { Priority, Status } from "./types";

/** Hours a ticket may stay unresolved before it counts as overdue. */
export const SLA_HOURS: Record<Priority, number> = {
  urgent: 4,
  high: 24,
  medium: 72,
  low: 168,
};

const ACTIVE: readonly Status[] = ["open", "in_progress"];

export function isOverdue(ticket: { status: Status; priority: Priority; createdAt: string }, now: Date): boolean {
  if (!ACTIVE.includes(ticket.status)) return false;
  const ageMs = now.getTime() - new Date(ticket.createdAt).getTime();
  return ageMs > SLA_HOURS[ticket.priority] * 60 * 60 * 1000;
}

const TRANSITIONS: Record<Status, readonly Status[]> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["open", "resolved", "closed"],
  resolved: ["in_progress", "closed"],
  closed: ["open"],
};

export function canTransition(from: Status, to: Status): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/** "45m", "3h 20m", "2d 4h". Durations under a minute round up to "1m". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

/** SQL CASE matching SLA_HOURS, so the overdue count in Postgres uses the same rules. */
export function slaIntervalSql(column = "priority"): string {
  const branches = Object.entries(SLA_HOURS)
    .map(([priority, hours]) => `WHEN '${priority}' THEN interval '${hours} hours'`)
    .join(" ");
  return `(CASE ${column} ${branches} END)`;
}
