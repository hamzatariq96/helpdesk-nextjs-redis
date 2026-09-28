import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { destroySession, SESSION_COOKIE } from "@/lib/session";

export const POST = route(async () => {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (sessionId) await destroySession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});
