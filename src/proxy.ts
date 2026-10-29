import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = ["speego_session", "__Host-speego_session"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    // Cookie presence does not prove the session is still valid.
    return NextResponse.next();
  }
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|api(?:/|$)).*)"],
};
