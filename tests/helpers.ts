import { pool } from "@/lib/db";
import { runMigrations } from "@/lib/migrations";
import { redis } from "@/lib/redis";
import type { SessionUser } from "@/lib/types";
import { createUser } from "@/repositories/users";

/** Fresh schema once per file, empty tables and an empty Redis DB before every test. */
export function useCleanState(): void {
  beforeAll(async () => {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE ticket_comments, tickets, users RESTART IDENTITY CASCADE");
    await redis.flushdb();
  });

  afterAll(async () => {
    await pool.end();
    redis.disconnect();
  });
}

export async function makeUser(name: string, role: SessionUser["role"] = "agent"): Promise<SessionUser> {
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
  const user = await createUser({ email, name, password: "correct-horse", role });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Moves a ticket's timestamps into the past, since tests can't wait hours for SLAs. */
export async function backdateTicket(id: number, hoursAgo: number): Promise<void> {
  await pool.query(
    `UPDATE tickets SET created_at = now() - make_interval(hours => $2), updated_at = now() - make_interval(hours => $2) WHERE id = $1`,
    [id, hoursAgo],
  );
}
