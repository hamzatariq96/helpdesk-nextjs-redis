import { HttpError } from "./errors";
import { DUMMY_HASH, verifyPassword } from "./password";
import { hitRateLimit, resetRateLimit } from "./rateLimit";
import { createSession } from "./session";
import type { SessionUser } from "./types";
import { findUserByEmail } from "@/repositories/users";

export const LOGIN_ATTEMPTS = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

/**
 * Checks credentials and opens a session. Attempts are limited per email + client
 * address, so one attacker can't lock a user out from everywhere.
 */
export async function login(
  email: string,
  password: string,
  clientAddress: string,
): Promise<{ sessionId: string; user: SessionUser }> {
  const limitKey = `login:${clientAddress}:${email}`;
  const limit = await hitRateLimit(limitKey, LOGIN_ATTEMPTS, LOGIN_WINDOW_SECONDS);
  if (!limit.allowed) {
    throw new HttpError(429, "Too many login attempts. Try again later.", {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const record = await findUserByEmail(email);
  const valid = await verifyPassword(password, record?.passwordHash ?? DUMMY_HASH);
  if (!record || !valid) throw new HttpError(401, "Invalid email or password");

  await resetRateLimit(limitKey);
  const user: SessionUser = { id: record.id, name: record.name, email: record.email, role: record.role };
  return { sessionId: await createSession(user), user };
}
