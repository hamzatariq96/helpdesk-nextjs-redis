import { randomBytes } from "node:crypto";
import { redis } from "./redis";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "hd_session";
const KEY_PREFIX = "session:";

export function sessionTtlSeconds(): number {
  return Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24);
}

/**
 * Sessions live in Redis rather than in a signed cookie, so they can be revoked
 * instantly and every request avoids a database round trip for the user record.
 */
export async function createSession(user: SessionUser): Promise<string> {
  const id = randomBytes(32).toString("base64url");
  await redis.set(KEY_PREFIX + id, JSON.stringify(user), "EX", sessionTtlSeconds());
  return id;
}

/** Returns the session user and slides the expiry forward on each use. */
export async function getSession(id: string): Promise<SessionUser | null> {
  const key = KEY_PREFIX + id;
  const [[, raw]] = (await redis.multi().get(key).expire(key, sessionTtlSeconds()).exec()) as [
    [Error | null, string | null],
    [Error | null, number],
  ];
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export async function destroySession(id: string): Promise<void> {
  await redis.del(KEY_PREFIX + id);
}
