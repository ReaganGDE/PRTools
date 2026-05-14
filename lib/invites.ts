import { db } from "@/lib/db";
import { workspaceInvites, users, workspaces } from "@/lib/db/schema";
import { resend } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

const INVITE_TTL_DAYS = 7;

export async function createInvite(args: {
  workspaceId: string;
  email: string;
  invitedBy: string;
  role?: "admin" | "member";
}) {
  const token = nanoid(32);
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const [invite] = await db
    .insert(workspaceInvites)
    .values({
      workspaceId: args.workspaceId,
      email: args.email.toLowerCase(),
      invitedBy: args.invitedBy,
      role: args.role ?? "member",
      token,
      expiresAt,
    })
    .returning();

  const [ws] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, args.workspaceId));

  const url = `${env.AUTH_URL}/invite/${token}`;
  await resend().emails.send({
    from: env.EMAIL_FROM,
    to: args.email,
    subject: `You're invited to ${ws?.name ?? "a workspace"}`,
    html: `<p>You've been invited to join <strong>${ws?.name}</strong> on Influencer & PR Tracker.</p>
           <p><a href="${url}">Accept the invite</a></p>
           <p>This link expires in ${INVITE_TTL_DAYS} days.</p>`,
  });

  return invite;
}

export async function acceptInvite(args: { token: string; userId: string }) {
  const [invite] = await db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.token, args.token));

  if (!invite) return { ok: false as const, error: "Invite not found" };
  if (invite.acceptedAt)
    return { ok: false as const, error: "Invite already used" };
  if (invite.expiresAt < new Date())
    return { ok: false as const, error: "Invite expired" };

  await db
    .update(users)
    .set({ workspaceId: invite.workspaceId, role: invite.role })
    .where(eq(users.id, args.userId));

  await db
    .update(workspaceInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(workspaceInvites.id, invite.id));

  return { ok: true as const, workspaceId: invite.workspaceId };
}

export async function listInvites(workspaceId: string) {
  return db
    .select()
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
      ),
    );
}
