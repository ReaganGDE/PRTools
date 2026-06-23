import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/verify",
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/u/",
  "/_next",
  "/favicon",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Expose the pathname to server components (the app layout reads this to
  // enforce onboarding access restrictions at a single choke point).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  const pass = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return pass();
  }

  if (!req.auth) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return pass();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
