import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const GATE_PASSWORD = "123";
const GATE_COOKIE = "gate_pass";
const EXCLUDED_PATHS = ["/gate", "/_next", "/api", "/pos", "/demos", "/favicon.ico", "/robots.txt"];

// POS-Ansage-MP3s liegen als Static Assets unter `public/pos-audio`. Der
// Direktzugriff wird gesperrt; ausgeliefert werden sie ausschließlich über die
// authentifizierte Route `/api/pos/audio/[key]` (via `ASSETS`-Binding).
const BLOCKED_PREFIXES = ["/pos-audio"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return new NextResponse("Not found", { status: 404 });
  }

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
