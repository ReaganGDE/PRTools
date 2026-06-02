"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { keywords } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { pollWorkspace } from "@/lib/sentiment/orchestrator";

export async function addKeyword(formData: FormData) {
  const session = await requireSessionWithCap("sentiment.keywords.edit");
  const term = z
    .string()
    .trim()
    .min(1)
    .max(80)
    .parse(formData.get("term"));
  await db
    .insert(keywords)
    .values({ workspaceId: session.workspaceId, term, active: true });
  revalidatePath("/sentiment");
  revalidatePath("/settings/keywords");
}

export async function toggleKeyword(id: string, active: boolean) {
  const session = await requireSessionWithCap("sentiment.keywords.edit");
  await db
    .update(keywords)
    .set({ active })
    .where(
      and(eq(keywords.id, id), eq(keywords.workspaceId, session.workspaceId)),
    );
  revalidatePath("/sentiment");
  revalidatePath("/settings/keywords");
}

export async function deleteKeyword(id: string) {
  const session = await requireSessionWithCap("sentiment.keywords.edit");
  await db
    .delete(keywords)
    .where(
      and(eq(keywords.id, id), eq(keywords.workspaceId, session.workspaceId)),
    );
  revalidatePath("/sentiment");
  revalidatePath("/settings/keywords");
}

export async function triggerPoll() {
  const session = await requireSessionWithCap("sentiment.keywords.edit");
  const result = await pollWorkspace(session.workspaceId);
  revalidatePath("/sentiment");
  return result;
}
