"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  resourceGroups,
  resourceGroupMembers,
  resources,
  resourceGroupAssignments,
  resourceUserAssignments,
} from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";

// ─── Groups ──────────────────────────────────────────────────────────────────

export async function createGroup(formData: FormData) {
  const session = await requireSessionWithCap("resources.admin");
  const name = String(formData.get("name") ?? "").trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const color = String(formData.get("color") ?? "#6366f1");
  if (!name) throw new Error("Group name is required");

  await db.insert(resourceGroups).values({
    workspaceId: session.workspaceId,
    name,
    description,
    color,
  });

  revalidatePath("/settings/resources");
  revalidatePath("/resources");
}

export async function updateGroup(groupId: string, formData: FormData) {
  const session = await requireSessionWithCap("resources.admin");
  const name = String(formData.get("name") ?? "").trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const color = String(formData.get("color") ?? "#6366f1");
  if (!name) throw new Error("Group name is required");

  await db
    .update(resourceGroups)
    .set({ name, description, color })
    .where(
      and(
        eq(resourceGroups.id, groupId),
        eq(resourceGroups.workspaceId, session.workspaceId),
      ),
    );

  revalidatePath("/settings/resources");
  revalidatePath("/resources");
}

export async function deleteGroup(groupId: string, _formData: FormData) {
  const session = await requireSessionWithCap("resources.admin");

  await db
    .delete(resourceGroups)
    .where(
      and(
        eq(resourceGroups.id, groupId),
        eq(resourceGroups.workspaceId, session.workspaceId),
      ),
    );

  revalidatePath("/settings/resources");
  revalidatePath("/resources");
}

// ─── Group members ────────────────────────────────────────────────────────────

export async function addGroupMember(groupId: string, formData: FormData) {
  await requireSessionWithCap("resources.admin");
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) throw new Error("userId is required");

  await db
    .insert(resourceGroupMembers)
    .values({ groupId, userId })
    .onConflictDoNothing();

  revalidatePath("/settings/resources");
}

export async function removeGroupMember(groupId: string, userId: string, _formData: FormData) {
  await requireSessionWithCap("resources.admin");

  await db
    .delete(resourceGroupMembers)
    .where(
      and(
        eq(resourceGroupMembers.groupId, groupId),
        eq(resourceGroupMembers.userId, userId),
      ),
    );

  revalidatePath("/settings/resources");
}

// ─── Resources ────────────────────────────────────────────────────────────────

export async function createResource(formData: FormData) {
  const session = await requireSessionWithCap("resources.admin");

  const type = String(formData.get("type") ?? "link") as
    | "link"
    | "credential"
    | "document";
  const title = String(formData.get("title") ?? "").trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const url = (formData.get("url") as string | null)?.trim() || null;
  const username = (formData.get("username") as string | null)?.trim() || null;
  const password = (formData.get("password") as string | null)?.trim() || null;
  const externalUrl = (formData.get("externalUrl") as string | null)?.trim() || null;
  const groupIds = formData.getAll("groupIds").map(String).filter(Boolean);
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);

  if (!title) throw new Error("Resource title is required");

  const [inserted] = await db
    .insert(resources)
    .values({
      workspaceId: session.workspaceId,
      type,
      title,
      description,
      url,
      username,
      password,
      externalUrl,
      createdBy: session.userId,
    })
    .returning({ id: resources.id });

  const resourceId = inserted.id;

  if (groupIds.length > 0) {
    await db
      .insert(resourceGroupAssignments)
      .values(groupIds.map((groupId) => ({ resourceId, groupId })));
  }

  if (userIds.length > 0) {
    await db
      .insert(resourceUserAssignments)
      .values(userIds.map((userId) => ({ resourceId, userId })));
  }

  revalidatePath("/settings/resources");
  revalidatePath("/resources");
}

export async function updateResource(resourceId: string, formData: FormData) {
  const session = await requireSessionWithCap("resources.admin");

  const type = String(formData.get("type") ?? "link") as
    | "link"
    | "credential"
    | "document";
  const title = String(formData.get("title") ?? "").trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const url = (formData.get("url") as string | null)?.trim() || null;
  const username = (formData.get("username") as string | null)?.trim() || null;
  const password = (formData.get("password") as string | null)?.trim() || null;
  const externalUrl = (formData.get("externalUrl") as string | null)?.trim() || null;
  const groupIds = formData.getAll("groupIds").map(String).filter(Boolean);
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);

  if (!title) throw new Error("Resource title is required");

  await db
    .update(resources)
    .set({ type, title, description, url, username, password, externalUrl })
    .where(
      and(
        eq(resources.id, resourceId),
        eq(resources.workspaceId, session.workspaceId),
      ),
    );

  // Re-sync group assignments
  await db
    .delete(resourceGroupAssignments)
    .where(eq(resourceGroupAssignments.resourceId, resourceId));

  if (groupIds.length > 0) {
    await db
      .insert(resourceGroupAssignments)
      .values(groupIds.map((groupId) => ({ resourceId, groupId })));
  }

  // Re-sync user assignments
  await db
    .delete(resourceUserAssignments)
    .where(eq(resourceUserAssignments.resourceId, resourceId));

  if (userIds.length > 0) {
    await db
      .insert(resourceUserAssignments)
      .values(userIds.map((userId) => ({ resourceId, userId })));
  }

  revalidatePath("/settings/resources");
  revalidatePath("/resources");
}

export async function deleteResource(resourceId: string, _formData: FormData) {
  const session = await requireSessionWithCap("resources.admin");

  await db
    .delete(resources)
    .where(
      and(
        eq(resources.id, resourceId),
        eq(resources.workspaceId, session.workspaceId),
      ),
    );

  revalidatePath("/settings/resources");
  revalidatePath("/resources");
}
