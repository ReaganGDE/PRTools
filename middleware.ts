import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Expose the current pathname to server components via a request header so the
// app layout can enforce onboarding access restrictions at a single choke point.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
