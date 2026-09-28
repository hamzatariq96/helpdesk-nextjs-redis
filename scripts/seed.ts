import { pool } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { redis } from "../src/lib/redis";
import type { Priority, Status } from "../src/lib/types";

const DEMO_PASSWORD = "helpdesk123";

const USERS = [
  { email: "admin@helpdesk.test", name: "Sara Khan", role: "admin" },
  { email: "ali@helpdesk.test", name: "Ali Raza", role: "agent" },
  { email: "maria@helpdesk.test", name: "Maria Lopez", role: "agent" },
] as const;

// [title, priority, status, assignee index or null, hours ago, hours to resolve]
const TICKETS: [string, Priority, Status, number | null, number, number | null][] = [
  ["VPN disconnects every hour on Windows laptops", "high", "in_progress", 1, 30, null],
  ["Payroll export shows wrong currency", "urgent", "open", null, 6, null],
  ["New hire needs access to the design drive", "medium", "open", 2, 20, null],
  ["Printer on 3rd floor jams on double-sided jobs", "low", "open", null, 90, null],
  ["Password reset email goes to spam", "high", "resolved", 1, 70, 9],
  ["Dashboard charts blank in Safari", "medium", "resolved", 2, 150, 30],
  ["Customer portal times out on large invoices", "urgent", "in_progress", 1, 3, null],
  ["Add SSO for the analytics tool", "medium", "open", 2, 200, null],
  ["Laptop battery swelling, needs replacement", "high", "closed", 1, 260, 4],
  ["Slack notifications duplicated", "low", "resolved", 2, 120, 50],
  ["Two-factor codes arrive late", "high", "open", 1, 12, null],
  ["Monthly report missing last day of data", "medium", "in_progress", 2, 40, null],
  ["Guest Wi-Fi password rotation", "low", "closed", 1, 300, 20],
  ["CRM sync stuck since Friday", "urgent", "resolved", 2, 100, 3],
  ["Request: second monitor for support team", "low", "open", null, 10, null],
  ["Shared calendar invites show wrong timezone", "medium", "resolved", 1, 55, 26],
];

async function main() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  if (rows[0].count > 0) {
    console.log("Seed data already present, skipping.");
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const userIds: number[] = [];
  for (const user of USERS) {
    const result = await pool.query(
      "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
      [user.email, user.name, passwordHash, user.role],
    );
    userIds.push(result.rows[0].id);
  }

  for (const [title, priority, status, assignee, hoursAgo, hoursToResolve] of TICKETS) {
    const { rows: inserted } = await pool.query(
      `INSERT INTO tickets (title, priority, status, created_by, assignee_id, created_at, updated_at, resolved_at)
       VALUES ($1, $2, $3, $4, $5,
               now() - make_interval(hours => $6),
               now() - make_interval(hours => $6) + make_interval(hours => COALESCE($7, 0)),
               CASE WHEN $7::int IS NULL THEN NULL ELSE now() - make_interval(hours => $6) + make_interval(hours => $7) END)
       RETURNING id`,
      [title, priority, status, userIds[0], assignee === null ? null : userIds[assignee], hoursAgo, hoursToResolve],
    );
    if (assignee !== null) {
      await pool.query(
        `INSERT INTO ticket_comments (ticket_id, author_id, body, created_at)
         VALUES ($1, $2, $3, now() - make_interval(hours => $4))`,
        [inserted[0].id, userIds[assignee], "Picked this up, looking into it now.", Math.max(hoursAgo - 1, 0)],
      );
    }
  }

  await redis.flushdb();
  console.log(`Seeded ${USERS.length} users and ${TICKETS.length} tickets.`);
  console.log(`Sign in with any of: ${USERS.map((u) => u.email).join(", ")} / password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    redis.disconnect();
  });
