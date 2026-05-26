"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, requireSessionWithCap } from "@/lib/auth-helpers";
import { createInvite, revokeInvite } from "@/lib/invites";
import { logAudit } from "@/lib/audit";

const ToolAccessInput = z.object({
  userId: z.string(),
  toolAccess: z.enum(["all", "pr_only", "social_only"]),
});

export async function changeToolAccess(userId: string, formData: FormData) {
  const session = await requireSessionWithCap("team.role.change");
  const parsed = ToolAccessInput.parse({
    userId,
    toolAccess: formData.get("toolAccess"),
  });
  const [target] = await db
    .select({ workspaceId: users.workspaceId, role: users.role })
    .from(users)
    .where(eq(users.id, parsed.userId));
  if (!target || target.workspaceId !== session.workspaceId) {
    throw new Error("User not found in this workspace");
  }
  if (target.role === "owner") {
    throw new Error("Cannot restrict the owner's tool access.");
  }
  await db
    .update(users)
    .set({ toolAccess: parsed.toolAccess })
    .where(eq(users.id, parsed.userId));
  revalidatePath("/settings/team");
}

const InviteInput = z.object({
  email: z.string().trim().email(),
  role: z.enum(["admin", "member", "viewer"]),
});

export async function sendInvite(formData: FormData) {
  const session = await requireSessionWithCap("team.invite");
  const parsed = InviteInput.parse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  await createInvite({
    workspaceId: session.workspaceId,
    email: parsed.email,
    invitedBy: session.userId,
    role: parsed.role,
  });
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "team.invite",
    meta: { email: parsed.email, role: parsed.role },
  });
  revalidatePath("/settings/team");
}

export async function revokePendingInvite(inviteId: string) {
  const session = await requireSessionWithCap("team.invite");
  await revokeInvite({ workspaceId: session.workspaceId, inviteId });
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "team.invite.revoke",
    targetType: "invite",
    targetId: inviteId,
  });
  revalidatePath("/settings/team");
}

const ChangeRoleInput = z.object({
  userId: z.string(),
  role: z.enum(["admin", "member", "viewer"]),
});

export async function changeRole(userId: string, formData: FormData) {
  const session = await requireSessionWithCap("team.role.change");
  const parsed = ChangeRoleInput.parse({
    userId,
    role: formData.get("role"),
  });
  if (parsed.userId === session.userId) {
    throw new Error("You can't change your own role here.");
  }
  // Make sure target is in this workspace and not the owner
  const [target] = await db
    .select({ workspaceId: users.workspaceId, role: users.role })
    .from(users)
    .where(eq(users.id, parsed.userId));
  if (!target || target.workspaceId !== session.workspaceId) {
    throw new Error("User not found in this workspace");
  }
  if (target.role === "owner") {
    throw new Error("Use 'Transfer ownership' to change the owner's role.");
  }
  await db
    .update(users)
    .set({ role: parsed.role })
    .where(eq(users.id, parsed.userId));
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "team.role.change",
    targetType: "user",
    targetId: parsed.userId,
    meta: { fromRole: target.role, toRole: parsed.role },
  });
  revalidatePath("/settings/team");
}

export async function removeMember(userId: string) {
  const session = await requireSessionWithCap("team.remove");
  if (userId === session.userId) {
    throw new Error("You can't remove yourself.");
  }
  const [target] = await db
    .select({ workspaceId: users.workspaceId, role: users.role })
    .from(users)
    .where(eq(users.id, userId));
  if (!target || target.workspaceId !== session.workspaceId) {
    throw new Error("User not found in this workspace");
  }
  if (target.role === "owner") {
    throw new Error("Cannot remove the owner.");
  }
  // Admin cannot remove another admin (only owner can)
  if (target.role === "admin" && session.role !== "owner") {
    throw new Error("Only the owner can remove an admin.");
  }
  await db
    .update(users)
    .set({ workspaceId: null, role: "member" })
    .where(eq(users.id, userId));
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "team.remove",
    targetType: "user",
    targetId: userId,
    meta: { previousRole: target.role },
  });
  revalidatePath("/settings/team");
}

export async function transferOwnership(newOwnerId: string) {
  const session = await requireSession();
  if (session.role !== "owner") {
    throw new Error("Only the owner can transfer ownership.");
  }
  const [target] = await db
    .select({ workspaceId: users.workspaceId })
    .from(users)
    .where(eq(users.id, newOwnerId));
  if (!target || target.workspaceId !== session.workspaceId) {
    throw new Error("New owner must already be in this workspace.");
  }
  // Demote current owner to admin, promote new owner
  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, session.userId));
  await db
    .update(users)
    .set({ role: "owner" })
    .where(eq(users.id, newOwnerId));
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "team.transfer_ownership",
    targetType: "user",
    targetId: newOwnerId,
    meta: { previousOwner: session.userId },
  });
  revalidatePath("/settings/team");
}

