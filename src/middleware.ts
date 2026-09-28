import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "hd_session";
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

/**
 * Cheap first gate at the edge: no cookie, no entry. The real session check
 * against Redis happens on the server in requireUser / requireApiUser.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
