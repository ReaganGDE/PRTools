import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

// Mirrors the session.maxAge configured in lib/auth.ts (90 days).
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

// Whether to use the "__Secure-" cookie prefix. Auth.js bases this on whether
// the site is served over https; we match that so the cookie name lines up
// with what auth() reads back.
function useSecureCookies(): boolean {
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  if (authUrl.startsWith("https://")) return true;
  if (authUrl.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production";
}

function sessionCookieName(): string {
  return useSecureCookies()
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

// Create a database session for the user and set the Auth.js session cookie.
// This is the same session shape the DrizzleAdapter creates for magic-link
// sign-ins, so auth(), the session callback, and impersonation all work
// identically afterward.
export async function createSessionForUser(userId: string): Promise<void> {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + MAX_AGE_SECONDS * 1000);

  await db.insert(sessions).values({ sessionToken, userId, expires });

  const jar = await cookies();
  jar.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecureCookies(),
    expires,
  });
}

// Delete the current session row and clear its cookie (sign out).
export async function signOutCurrentSession(): Promise<void> {
  const jar = await cookies();
  const name = sessionCookieName();
  const token = jar.get(name)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.sessionToken, token));
  }
  jar.delete(name);
}
