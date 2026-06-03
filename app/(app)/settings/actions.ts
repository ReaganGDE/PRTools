"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

export async function updateFollowUpDays(days: number): Promise<void> {
  const session = await requireSession();
  const n = Math.max(1, Math.min(30, Math.round(days)));
  await db
    .update(workspaces)
    .set({ followUpDays: n })
    .where(eq(workspaces.id, session.workspaceId));
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
