"use server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

export async function listSavedSearches(type: "influencer" | "pr") {
  const session = await requireSession();
  return db
    .select({
      id: savedSearches.id,
      name: savedSearches.name,
      query: savedSearches.query,
      platforms: savedSearches.platforms,
    })
    .from(savedSearches)
    .where(
      and(
        eq(savedSearches.workspaceId, session.workspaceId),
        eq(savedSearches.type, type),
      ),
    )
    .orderBy(savedSearches.createdAt);
}

export async function saveSearch(
  type: "influencer" | "pr",
  name: string,
  query: string,
  platforms: string[],
): Promise<void> {
  const session = await requireSession();
  await db.insert(savedSearches).values({
    id: nanoid(16),
    workspaceId: session.workspaceId,
    type,
    name,
    query,
    platforms,
  });
  revalidatePath("/influencers");
  revalidatePath("/pr-finder");
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const session = await requireSession();
  await db
    .delete(savedSearches)
    .where(
      and(
        eq(savedSearches.id, id),
        eq(savedSearches.workspaceId, session.workspaceId),
      ),
    );
  revalidatePath("/influencers");
  revalidatePath("/pr-finder");
}
