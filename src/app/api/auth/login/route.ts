import { NextResponse } from "next/server";
import { login } from "@/lib/authService";
import { readJson, route } from "@/lib/http";
import { SESSION_COOKIE, sessionTtlSeconds } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export const POST = route(async (request) => {
  const { email, password } = loginSchema.parse(await readJson(request));
  const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  const { sessionId, user } = await login(email, password, clientAddress);

  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: sessionTtlSeconds(),
  });
  return response;
});
