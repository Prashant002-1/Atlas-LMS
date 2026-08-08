import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Atlas is signed-in software. Only authentication and health endpoints enter
 * without an Auth.js session. Every public machine endpoint performs its own
 * authentication.
 */

const PUBLIC_PATHS = new Set(["/sign-in", "/sign-up"]);
const PUBLIC_PREFIXES = ["/api/auth", "/api/health"];

function hasSessionCookie(req: NextRequest): boolean {
  return Boolean(
    req.cookies.get("authjs.session-token")?.value || req.cookies.get("__Secure-authjs.session-token")?.value
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const signedIn = hasSessionCookie(req);

  if (!isPublic && !signedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    const signIn = new URL("/sign-in", req.url);
    if (pathname !== "/") signIn.searchParams.set("from", pathname);
    return NextResponse.redirect(signIn);
  }

  if (signedIn && PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|.well-known/workflow/|.*\\..*).*)",
    "/api/:path*",
  ],
};
