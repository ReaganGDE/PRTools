import { db } from "@/lib/db";
import { workspaceInvites, users, workspaces } from "@/lib/db/schema";
import { resend } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Role } from "@/lib/permissions";

const INVITE_TTL_DAYS = 7;

export async function createInvite(args: {
  workspaceId: string;
  email: string;
  invitedBy: string;
  role?: Role;
}) {
  const token = nanoid(32);
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  // Owner can only be transferred, not directly invited
  const role: Role = args.role && args.role !== "owner" ? args.role : "member";

  const [invite] = await db
    .insert(workspaceInvites)
    .values({
      workspaceId: args.workspaceId,
      email: args.email.toLowerCase(),
      invitedBy: args.invitedBy,
      role,
      token,
      expiresAt,
    })
    .returning();

  const [ws] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, args.workspaceId));

  const url = `${env.AUTH_URL}/invite/${token}`;

  // Best-effort email. If Resend is in sandbox mode (unverified domain), it
  // only delivers to the account owner's own address, so invites to other
  // inboxes silently never arrive. We don't want that to discard the invite —
  // the link is always copyable from the Team page, so swallow send errors and
  // report whether delivery was actually attempted successfully.
  let emailed = false;
  try {
    await resend().emails.send({
      from: env.EMAIL_FROM,
      to: args.email,
      subject: `You're invited to ${ws?.name ?? "a workspace"}`,
      html: `<p>You've been invited to join <strong>${ws?.name}</strong> on Influencer & PR Tracker as <strong>${role}</strong>.</p>
             <p><a href="${url}">Accept the invite</a></p>
             <p>This link expires in ${INVITE_TTL_DAYS} days.</p>`,
    });
    emailed = true;
  } catch (err) {
    console.error("createInvite: failed to send invite email", err);
  }

  return { ...invite, url, emailed };
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

  // Load the accepting user so we can guard against two foot-guns:
  //  1. Accepting an invite meant for a different email (would hijack the row).
  //  2. Accepting while already in a workspace — most importantly, an owner/
  //     admin clicking the link in their own browser and getting demoted to
  //     the invite's (lower) role.
  const [user] = await db
    .select({ email: users.email, workspaceId: users.workspaceId })
    .from(users)
    .where(eq(users.id, args.userId));

  if (!user) return { ok: false as const, error: "Account not found" };

  if (
    user.email &&
    user.email.toLowerCase() !== invite.email.toLowerCase()
  ) {
    return {
      ok: false as const,
      error: `This invite was sent to ${invite.email}. You're signed in as ${user.email}. Sign in with the invited address to accept.`,
    };
  }

  if (user.workspaceId) {
    if (user.workspaceId === invite.workspaceId) {
      // Already a member of this workspace — nothing to do, don't change role.
      await db
        .update(workspaceInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(workspaceInvites.id, invite.id));
      return { ok: true as const, workspaceId: invite.workspaceId };
    }
    return {
      ok: false as const,
      error:
        "You already belong to a workspace. Leave it before accepting a new invite.",
    };
  }

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
    .where(and(eq(workspaceInvites.workspaceId, workspaceId)));
}

export async function revokeInvite(args: {
  workspaceId: string;
  inviteId: string;
}) {
  await db
    .delete(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, args.inviteId),
        eq(workspaceInvites.workspaceId, args.workspaceId),
      ),
    );
}
