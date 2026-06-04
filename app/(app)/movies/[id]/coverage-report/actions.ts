"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { movies } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

export async function generateReportToken(movieId: string): Promise<string> {
  const session = await requireSession();
  const token = nanoid(24);
  await db
    .update(movies)
    .set({ coverageReportToken: token })
    .where(
      and(eq(movies.id, movieId), eq(movies.workspaceId, session.workspaceId)),
    );
  revalidatePath(`/movies/${movieId}/coverage-report`);
  return token;
}

export async function revokeReportToken(movieId: string): Promise<void> {
  const session = await requireSession();
  await db
    .update(movies)
    .set({ coverageReportToken: null })
    .where(
      and(eq(movies.id, movieId), eq(movies.workspaceId, session.workspaceId)),
    );
  revalidatePath(`/movies/${movieId}/coverage-report`);
}
