import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  workspaces,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
  },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? "",
      from: process.env.EMAIL_FROM ?? "noreply@example.com",
    }),
  ],
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
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      session.user.id = user.id;
      session.user.workspaceId = row?.workspaceId ?? null;
      session.user.role = row?.role ?? "member";
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
