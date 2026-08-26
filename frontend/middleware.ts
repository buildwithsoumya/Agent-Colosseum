import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side gate for role-scoped areas. This middleware enforces that the
 * visitor holds a session cookie before any protected dashboard is rendered,
 * redirecting anonymous users to /login (preserving the intended destination).
 *
 * Role enforcement (an authenticated user hitting another role's area) is the
 * job of the backend APIs plus the RequireRole guard, which renders a 403
 * Access Restricted page rather than merely hiding chrome. The middleware only
 * rejects unauthenticated traffic at the edge and never trusts client roles.
 */

const SESSION_COOKIE = "ac_session";

export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protect the role-scoped shells at the edge; let static/public routes through.
  matcher: ["/admin/:path*", "/mentor/:path*", "/dashboard/:path*"],
};