"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { movies } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

const STATUSES = ["in_production", "pre_release", "released", "archived"] as const;
type Status = (typeof STATUSES)[number];

export async function createMovie(formData: FormData) {
  const session = await requireSession();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const brandId = (formData.get("brandId") as string | null) || null;
  const distributor = (formData.get("distributor") as string | null) || null;
  const mpaaRating = (formData.get("mpaaRating") as string | null) || null;
  const synopsis = (formData.get("synopsis") as string | null) || null;
  const posterUrl = (formData.get("posterUrl") as string | null) || null;
  const releaseDateStr = formData.get("releaseDate") as string | null;
  const releaseDate = releaseDateStr ? new Date(releaseDateStr) : null;
  const manageSocials = formData.get("manageSocials") === "on";
  const statusRaw = String(formData.get("status") ?? "in_production");
  const status: Status = STATUSES.includes(statusRaw as Status)
    ? (statusRaw as Status)
    : "in_production";

  await db.insert(movies).values({
    workspaceId: session.workspaceId,
    brandId,
    title,
    distributor,
    mpaaRating,
    synopsis,
    posterUrl,
    releaseDate,
    manageSocials,
    status,
  });
  revalidatePath("/movies");
}

export async function updateMovie(movieId: string, formData: FormData) {
  const session = await requireSession();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const brandId = (formData.get("brandId") as string | null) || null;
  const distributor = (formData.get("distributor") as string | null) || null;
  const mpaaRating = (formData.get("mpaaRating") as string | null) || null;
  const releaseDateStr = formData.get("releaseDate") as string | null;
  const releaseDate = releaseDateStr ? new Date(releaseDateStr) : null;
  const manageSocials = formData.get("manageSocials") === "on";
  const statusRaw = String(formData.get("status") ?? "in_production");
  const status: Status = STATUSES.includes(statusRaw as Status)
    ? (statusRaw as Status)
    : "in_production";

  await db
    .update(movies)
    .set({
      title,
      brandId,
      distributor,
      mpaaRating,
      releaseDate,
      manageSocials,
      status,
    })
    .where(
      and(eq(movies.id, movieId), eq(movies.workspaceId, session.workspaceId)),
    );
  revalidatePath("/movies");
  revalidatePath(`/movies/${movieId}`);
}

export async function deleteMovie(movieId: string) {
  const session = await requireSession();
  await db
    .delete(movies)
    .where(
      and(eq(movies.id, movieId), eq(movies.workspaceId, session.workspaceId)),
    );
  revalidatePath("/movies");
  redirect("/movies");
}
