import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const GATE_PASSWORD = "123";
const GATE_COOKIE = "gate_pass";
const EXCLUDED_PATHS = ["/gate", "/_next", "/api", "/pos", "/demos", "/favicon.ico", "/robots.txt"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isExcluded = EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isExcluded) return NextResponse.next();

  const gateCookie = request.cookies.get(GATE_COOKIE);
  if (gateCookie?.value === GATE_PASSWORD) return NextResponse.next();

  const gateUrl = new URL("/gate", request.url);
  gateUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(gateUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
