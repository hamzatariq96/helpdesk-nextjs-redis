import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HttpError } from "./errors";
import { getSession, SESSION_COOKIE } from "./session";
import type { Role, SessionUser } from "./types";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  return sessionId ? getSession(sessionId) : null;
}

/** For pages: send signed-out visitors to the login screen. */
export async function requireUser(role?: Role): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect("/");
  return user;
}

/** For API routes: fail with 401/403 instead of redirecting. */
export async function requireApiUser(role?: Role): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in");
  if (role && user.role !== role) throw new HttpError(403, "Not allowed");
  return user;
}
