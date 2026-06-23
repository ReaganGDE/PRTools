import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  workspaces,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const providers = [
  Resend({
    apiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.EMAIL_FROM ?? "noreply@example.com",
  }),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),
];

export { providers };

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "database",
    maxAge: 90 * 24 * 60 * 60, // 90 days
    updateAge: 7 * 24 * 60 * 60, // refresh DB row once a week
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
  },
  providers,
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return true;
    },
    async session({ session, user }) {
      // Attach workspaceId + role so route handlers/pages can scope queries.
      const [row] = await db
        .select({
          workspaceId: users.workspaceId,
          role: users.role,
          isOnboarding: users.isOnboarding,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      session.user.id = user.id;
      session.user.workspaceId = row?.workspaceId ?? null;
      session.user.role = row?.role ?? "member";
      session.user.isOnboarding = row?.isOnboarding ?? false;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // First user creates a workspace; subsequent users land without one
      // and must accept an invite (handled in /invite/[token] route).
      if (!user.id || !user.email) return;
      const existing = await db.select({ id: users.id }).from(users);
      const isFirstUser = existing.length === 1; // just-created user
      if (isFirstUser) {
        const [ws] = await db
          .insert(workspaces)
          .values({ name: `${user.email.split("@")[0]}'s workspace` })
          .returning();
        await db
          .update(users)
          .set({ workspaceId: ws.id, role: "owner" })
          .where(eq(users.id, user.id));
      }
    },
  },
});
