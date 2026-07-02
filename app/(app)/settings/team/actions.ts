"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, departments } from "@/lib/db/schema";
import { requireSession, requireSessionWithCap } from "@/lib/auth-helpers";
import { createInvite, revokeInvite } from "@/lib/invites";

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
  revalidatePath("/settings/team");
}

export async function revokePendingInvite(inviteId: string) {
  const session = await requireSessionWithCap("team.invite");
  await revokeInvite({ workspaceId: session.workspaceId, inviteId });
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
  revalidatePath("/settings/team");
}

/* ───────────────────── Departments ───────────────────── */

export async function createDepartment(formData: FormData) {
  const session = await requireSessionWithCap("team.department.manage");
  const name = z.string().trim().min(1).parse(formData.get("name"));
  await db
    .insert(departments)
    .values({ workspaceId: session.workspaceId, name })
    .onConflictDoNothing();
  revalidatePath("/settings/team");
  revalidatePath("/resources");
}

export async function deleteDepartment(departmentId: string) {
  const session = await requireSessionWithCap("team.department.manage");
  await db
    .delete(departments)
    .where(
      and(
        eq(departments.id, departmentId),
        eq(departments.workspaceId, session.workspaceId),
      ),
    );
  revalidatePath("/settings/team");
  revalidatePath("/resources");
}

export async function setMemberDepartment(userId: string, formData: FormData) {
  const session = await requireSessionWithCap("team.department.manage");
  const departmentId = String(formData.get("departmentId") ?? "");
  const [target] = await db
    .select({ workspaceId: users.workspaceId })
    .from(users)
    .where(eq(users.id, userId));
  if (!target || target.workspaceId !== session.workspaceId) {
    throw new Error("User not found in this workspace");
  }
  if (departmentId) {
    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(
        and(
          eq(departments.id, departmentId),
          eq(departments.workspaceId, session.workspaceId),
        ),
      );
    if (!dept) throw new Error("Department not found");
  }
  await db
    .update(users)
    .set({ departmentId: departmentId || null })
    .where(eq(users.id, userId));
  revalidatePath("/settings/team");
  revalidatePath("/resources");
}

