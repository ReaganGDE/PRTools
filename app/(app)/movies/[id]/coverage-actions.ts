"use server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { movieCoverages } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

export async function addMovieCoverage(
  movieId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const outlet = String(formData.get("outlet") ?? "").trim() || null;
  const headline = String(formData.get("headline") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim() || null;
  const publishedAtRaw = String(formData.get("publishedAt") ?? "").trim();
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : null;
  const sentiment = (formData.get("sentiment") as "positive" | "neutral" | "negative" | null) || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!outlet && !headline && !url) return;

  await db.insert(movieCoverages).values({
    id: nanoid(16),
    workspaceId: session.workspaceId,
    movieId,
    outlet,
    headline,
    url,
    publishedAt,
    sentiment,
    notes,
    addedBy: session.userId,
  });
  revalidatePath(`/movies/${movieId}`);
}

export async function removeMovieCoverage(
  movieId: string,
  coverageId: string,
): Promise<void> {
  const session = await requireSession();
  await db
    .delete(movieCoverages)
    .where(
      and(
        eq(movieCoverages.id, coverageId),
        eq(movieCoverages.workspaceId, session.workspaceId),
      ),
    );
  revalidatePath(`/movies/${movieId}`);
}
