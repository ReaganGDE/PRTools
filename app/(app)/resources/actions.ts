"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

export async function createPersonalResource(formData: FormData) {
  const session = await requireSession();

  const type = formData.get("type") as "link" | "credential" | "document";
  const title = (formData.get("title") as string | null)?.trim();

  if (!title) throw new Error("Title is required");
  if (!["link", "credential", "document"].includes(type)) {
    throw new Error("Invalid resource type");
  }

  await db.insert(resources).values({
    workspaceId: session.workspaceId,
    type,
    title,
    description: (formData.get("description") as string | null)?.trim() || null,
    url: (formData.get("url") as string | null)?.trim() || null,
    username: (formData.get("username") as string | null)?.trim() || null,
    password: (formData.get("password") as string | null) || null,
    isPersonal: true,
    createdBy: session.userId,
  });

  revalidatePath("/resources");
}

export async function deletePersonalResource(resourceId: string) {
  const session = await requireSession();

  await db
    .delete(resources)
    .where(
      and(
        eq(resources.id, resourceId),
        eq(resources.createdBy, session.userId),
        eq(resources.isPersonal, true),
      ),
    );

  revalidatePath("/resources");
}
