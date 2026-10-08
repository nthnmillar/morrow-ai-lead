import { NextResponse, type NextRequest } from "next/server";
import { DEMO_SESSION_COOKIE, parseDemoSessionId } from "@/lib/demo-session";

export function proxy(request: NextRequest) {
  if (parseDemoSessionId(request.cookies.get(DEMO_SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const response = NextResponse.redirect(request.nextUrl);
  response.cookies.set(DEMO_SESSION_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
