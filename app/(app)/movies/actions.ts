"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { movies, brands, workspaces } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import {
  fetchAllRecords,
  pickPosterUrl,
  readAttachments,
  readDate,
  readString,
} from "@/lib/integrations/airtable";

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

// Pull records from each brand's mapped Airtable table and upsert into movies.
// Uses (workspace_id, airtable_record_id) as the upsert key — re-running the
// sync updates titles/synopses/posters in place rather than duplicating.
export type SyncResult = {
  brand: string;
  inserted: number;
  updated: number;
  skipped: number;
  error?: string;
};

export async function syncMoviesFromAirtable(): Promise<{
  results: SyncResult[];
  total: { inserted: number; updated: number };
}> {
  const session = await requireSession();

  const [ws] = await db
    .select({ token: workspaces.airtableToken, baseId: workspaces.airtableBaseId })
    .from(workspaces)
    .where(eq(workspaces.id, session.workspaceId));
  if (!ws?.token || !ws?.baseId) {
    throw new Error(
      "Airtable not configured. Add your token and base ID in /settings/integrations.",
    );
  }

  const brandRows = await db
    .select()
    .from(brands)
    .where(eq(brands.workspaceId, session.workspaceId));
  const mapped = brandRows.filter((b) => b.airtableTableId);
  if (mapped.length === 0) {
    throw new Error(
      "No brands are mapped to Airtable tables yet. Open /brands and set an Airtable table ID per brand.",
    );
  }

  const results: SyncResult[] = [];
  let totalInserted = 0;
  let totalUpdated = 0;

  for (const brand of mapped) {
    const result: SyncResult = {
      brand: brand.name,
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
    try {
      const records = await fetchAllRecords(
        ws.token,
        ws.baseId,
        brand.airtableTableId!,
      );

      for (const rec of records) {
        const f = rec.fields;
        const title = readString(f, "Name") ?? readString(f, "Title");
        if (!title) {
          result.skipped++;
          continue;
        }

        // Release date: prefer Theatrical, then TVOD, then CUTV
        const releaseDate =
          readDate(f, "Theatrical Date") ??
          readDate(f, "TVOD Date") ??
          readDate(f, "CUTV Date") ??
          null;

        const posterUrl = pickPosterUrl(
          readAttachments(f, "Stills & Press Materials") ??
            readAttachments(f, "Attachments"),
        );

        const values = {
          workspaceId: session.workspaceId,
          brandId: brand.id,
          title,
          releaseDate,
          synopsis: readString(f, "Synopsis"),
          logline: readString(f, "Logline"),
          tagline: readString(f, "Tagline"),
          mpaaRating: readString(f, "Suggested Rating") ?? readString(f, "MPAA Rating"),
          trailerUrl: readString(f, "Trailer Link"),
          imdbUrl: readString(f, "IMDB Link"),
          director: readString(f, "Director(s)") ?? readString(f, "Director"),
          castList: readString(f, "Cast"),
          producer: readString(f, "Producer(s)") ?? readString(f, "Producer"),
          distributor: readString(f, "Production Company") ?? readString(f, "Distributor"),
          posterUrl,
          airtableRecordId: rec.id,
          airtableSyncedAt: new Date(),
        };

        // Upsert by (workspace_id, airtable_record_id)
        const existing = await db
          .select({ id: movies.id })
          .from(movies)
          .where(
            and(
              eq(movies.workspaceId, session.workspaceId),
              eq(movies.airtableRecordId, rec.id),
            ),
          );

        if (existing.length > 0) {
          await db.update(movies).set(values).where(eq(movies.id, existing[0].id));
          result.updated++;
        } else {
          await db.insert(movies).values(values);
          result.inserted++;
        }
      }

      await db
        .update(brands)
        .set({ airtableLastSyncedAt: new Date() })
        .where(eq(brands.id, brand.id));

      totalInserted += result.inserted;
      totalUpdated += result.updated;
    } catch (e) {
      result.error = (e as Error).message;
    }
    results.push(result);
  }

  revalidatePath("/movies");
  return { results, total: { inserted: totalInserted, updated: totalUpdated } };
}

