import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/change-password",
  "/verify",
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/u/",
  "/_next",
  "/favicon",
];

// Auth.js v5 names the database-session cookie "authjs.session-token"
// ("__Secure-" prefixed over https). We only check for its presence here as a
// cheap early redirect — the authoritative session validation runs in the
// Node-runtime app layout via auth(). This keeps the Postgres-backed adapter
// out of the Edge middleware runtime, where it cannot run (doing so throws an
// Auth.js "Configuration" error on every request).
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export default function proxy(req: NextRequest) {
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

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return pass();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
