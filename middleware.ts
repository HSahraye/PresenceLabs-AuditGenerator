import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthEnabled } from "./src/lib/env";

function isInternalPath(pathname: string) {
  if (pathname.startsWith("/audit/")) return false;
  if (pathname.startsWith("/api/public/")) return false;
  if (pathname.startsWith("/api/stripe/webhook")) return false;
  if (pathname.startsWith("/login")) return false;
  if (pathname.startsWith("/_next")) return false;
  if (pathname === "/favicon.ico") return false;
  return true;
}

export function middleware(request: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (!isInternalPath(pathname)) return NextResponse.next();

  const token = request.cookies.get("pl_session")?.value;
  if (token) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
