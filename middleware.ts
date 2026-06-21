import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Atlas is signed-in software. Nothing renders without a session except the
 * auth pages themselves — there is no public marketing surface inside the app.
 *
 * The middleware checks for the Auth.js session cookie (cheap, edge-safe);
 * every page and API route still does full session validation server-side.
 */

const PUBLIC_PATHS = new Set(["/sign-in", "/sign-up"]);
const PUBLIC_PREFIXES = ["/api/auth", "/api/health", "/eve", "/_eve_internal/eve"];

function hasSessionCookie(req: NextRequest): boolean {
  return Boolean(
    req.cookies.get("authjs.session-token")?.value || req.cookies.get("__Secure-authjs.session-token")?.value
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const signedIn = hasSessionCookie(req);

  if (!isPublic && !signedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    const signIn = new URL("/sign-in", req.url);
    if (pathname !== "/") signIn.searchParams.set("from", pathname);
    return NextResponse.redirect(signIn);
  }

  // Signed-in users have no business on the auth pages.
  if (signedIn && PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except static assets and files with extensions.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|.*\\..*).*)", "/api/:path*"],
};
