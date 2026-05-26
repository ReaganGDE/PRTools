"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { movies, brands, workspaces } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import {
  fetchAllRecords,
  pickPosterUrl,
  readAttachments,
  readDate,
  readMultiSelect,
  readNumber,
  readString,
} from "@/lib/integrations/airtable";
import { lookupMoviePoster, searchMoviePoster } from "@/lib/integrations/tmdb";

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

// Delete all duplicate movies in the workspace. For each group of movies
// sharing the same lower-cased title, keep whichever row has an
// airtable_record_id (preferring the most recently synced), or the oldest row
// if all are manual. Re-points social_posts.movie_id before deleting.
async function dedupeMovies(workspaceId: string): Promise<number> {
  // Get all movies for the workspace, grouped conceptually by lower(title).
  const dupes = (await db.execute(sql`
    SELECT id, lower(title) AS key,
           airtable_record_id,
           airtable_synced_at,
           created_at
    FROM movies
    WHERE workspace_id = ${workspaceId}
    ORDER BY lower(title),
             (airtable_record_id IS NOT NULL) DESC,
             airtable_synced_at DESC NULLS LAST,
             created_at ASC
  `)) as unknown as {
    id: string;
    key: string;
    airtable_record_id: string | null;
    airtable_synced_at: Date | null;
    created_at: Date;
  }[];

  // Group by key; first entry in each group is the one we keep.
  const groups = new Map<string, string[]>();
  for (const row of dupes) {
    const list = groups.get(row.key) ?? [];
    list.push(row.id);
    groups.set(row.key, list);
  }

  let removed = 0;
  for (const [, ids] of groups) {
    if (ids.length <= 1) continue;
    const [keepId, ...deleteIds] = ids;
    for (const deleteId of deleteIds) {
      // Re-point any social posts before deleting
      await db.execute(sql`
        UPDATE social_posts SET movie_id = ${keepId} WHERE movie_id = ${deleteId}
      `);
      await db.execute(sql`DELETE FROM movies WHERE id = ${deleteId}`);
      removed++;
    }
  }
  return removed;
}

// Fetch posters from TMDB for any movie in the workspace that doesn't have one.
// Returns the number of posters added.
export async function backfillPostersFromTmdb(): Promise<{
  scanned: number;
  found: number;
  apiErrors: number;
  firstError: string | null;
  sampleMatches: string[];
}> {
  const session = await requireSession();

  if (!process.env.TMDB_API_KEY) {
    throw new Error(
      "TMDB_API_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.",
    );
  }
  const rows = await db
    .select({
      id: movies.id,
      title: movies.title,
      releaseDate: movies.releaseDate,
    })
    .from(movies)
    .where(
      and(
        eq(movies.workspaceId, session.workspaceId),
        sql`${movies.posterUrl} IS NULL`,
      ),
    );

  let found = 0;
  let apiErrors = 0;
  let firstError: string | null = null;
  const matched: string[] = [];

  for (const row of rows) {
    const r = await lookupMoviePoster(
      row.title,
      row.releaseDate?.getFullYear() ?? null,
    );
    if (!r.ok) {
      apiErrors++;
      if (!firstError) firstError = r.error;
      // If the very first call fails with an auth error, stop wasting requests.
      if (
        apiErrors === 1 &&
        (r.error.includes("401") ||
          r.error.toLowerCase().includes("invalid api key"))
      ) {
        throw new Error(`TMDB rejected the API key — ${r.error}`);
      }
      continue;
    }
    if (r.posterUrl) {
      await db
        .update(movies)
        .set({ posterUrl: r.posterUrl })
        .where(eq(movies.id, row.id));
      matched.push(`${row.title} → ${r.matchedTitle ?? "?"}`);
      found++;
    }
  }
  revalidatePath("/movies");
  return {
    scanned: rows.length,
    found,
    apiErrors,
    firstError,
    sampleMatches: matched.slice(0, 5),
  };
}

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

  // Build a lookup: normalized brand name → brand row. Used to route a record
  // to the right brand based on the Studio field (since one Sell Sheets table
  // contains films for multiple brands).
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const brandByName = new Map<string, (typeof brandRows)[number]>();
  for (const b of brandRows) brandByName.set(norm(b.name), b);

  // Dedupe tables — both brands may point to the same Sell Sheets table.
  const tableToBrands = new Map<string, typeof mapped>();
  for (const b of mapped) {
    const list = tableToBrands.get(b.airtableTableId!) ?? [];
    list.push(b);
    tableToBrands.set(b.airtableTableId!, list);
  }

  const results: SyncResult[] = [];
  let totalInserted = 0;
  let totalUpdated = 0;

  for (const [tableId, brandsForTable] of tableToBrands) {
    const tableLabel = brandsForTable.map((b) => b.name).join(" + ");
    const result: SyncResult = {
      brand: tableLabel,
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
    try {
      const records = await fetchAllRecords(ws.token, ws.baseId, tableId);

      for (const rec of records) {
        const f = rec.fields;
        const title = readString(f, "Name") ?? readString(f, "Title");
        if (!title) {
          result.skipped++;
          continue;
        }

        // Route to brand by matching Studio name; fall back to first brand
        // mapped to this table if no match.
        const studio = readString(f, "Studio");
        const studioBrand = studio ? brandByName.get(norm(studio)) : undefined;
        const brandForRecord = studioBrand ?? brandsForTable[0];

        const theatricalDate =
          readDate(f, "Theatrical Date") ??
          readDate(f, "Theatrical Release Date") ??
          readDate(f, "Theatrical Release");
        const tvodDate = readDate(f, "TVOD Date");
        const avodDate = readDate(f, "AVOD Date") ?? readDate(f, "CUTV Date");
        // TVOD Date is the canonical release date for our workflow.
        const releaseDate = tvodDate ?? theatricalDate ?? avodDate ?? null;

        let posterUrl = pickPosterUrl(
          readAttachments(f, "Stills & Press Materials") ??
            readAttachments(f, "Attachments"),
        );
        // Fall back to TMDB if Airtable doesn't have a poster for this title.
        if (!posterUrl) {
          posterUrl = await searchMoviePoster(
            title,
            releaseDate?.getFullYear() ?? null,
          );
        }

        // Infer status from release date so synced films aren't all "in_production"
        const today = new Date();
        const inferredStatus: Status =
          !releaseDate
            ? "in_production"
            : releaseDate <= today
              ? "released"
              : releaseDate <= new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
                ? "pre_release"
                : "in_production";

        const values = {
          workspaceId: session.workspaceId,
          brandId: brandForRecord.id,
          title,
          status: inferredStatus,
          releaseDate,
          theatricalDate,
          tvodDate,
          avodDate,
          synopsis: readString(f, "Synopsis"),
          logline: readString(f, "Logline"),
          tagline: readString(f, "Tagline"),
          studio,
          productionCompany: readString(f, "Production Company"),
          distributor: readString(f, "Distributor"),
          mpaaRating:
            readString(f, "Suggested Rating") ?? readString(f, "MPAA Rating"),
          runtime: readNumber(f, "Runtime"),
          language: readString(f, "Language"),
          territory: readString(f, "Territory") ?? readString(f, "Territories"),
          rights: readString(f, "Rights"),
          genres: readMultiSelect(f, "Genre"),
          compTitles: readString(f, "Comp Titles"),
          trailerUrl: readString(f, "Trailer Link"),
          trailerPassword: readString(f, "Trailer Password"),
          screenerUrl: readString(f, "Screener Link"),
          screenerPassword: readString(f, "Screener Password"),
          imdbUrl: readString(f, "IMDB Link"),
          websiteUrl: readString(f, "Website"),
          pressKitUrl: readString(f, "Press Kit Link"),
          socialMediaUrl: readString(f, "Social Media"),
          director: readString(f, "Director(s)") ?? readString(f, "Director"),
          writer: readString(f, "Writer(s)") ?? readString(f, "Writer"),
          castList: readString(f, "Cast"),
          producer: readString(f, "Producer(s)") ?? readString(f, "Producer"),
          copyrightLine: readString(f, "Copyright Line"),
          posterUrl,
          airtableRecordId: rec.id,
          airtableSyncedAt: new Date(),
        };

        // Match by airtable_record_id first; if not found, match by title
        // (case-insensitive) to absorb manually-created entries that pre-date
        // the Airtable sync.
        const byRecordId = await db
          .select({ id: movies.id })
          .from(movies)
          .where(
            and(
              eq(movies.workspaceId, session.workspaceId),
              eq(movies.airtableRecordId, rec.id),
            ),
          );

        let existingId: string | null = byRecordId[0]?.id ?? null;

        if (!existingId) {
          const byTitle = await db
            .select({ id: movies.id })
            .from(movies)
            .where(
              and(
                eq(movies.workspaceId, session.workspaceId),
                sql`lower(${movies.title}) = ${title.toLowerCase()}`,
                sql`${movies.airtableRecordId} IS NULL`,
              ),
            );
          existingId = byTitle[0]?.id ?? null;
        }

        if (existingId) {
          await db.update(movies).set(values).where(eq(movies.id, existingId));
          result.updated++;
        } else {
          await db.insert(movies).values(values);
          result.inserted++;
        }
      }

      const now = new Date();
      for (const b of brandsForTable) {
        await db
          .update(brands)
          .set({ airtableLastSyncedAt: now })
          .where(eq(brands.id, b.id));
      }

      totalInserted += result.inserted;
      totalUpdated += result.updated;
    } catch (e) {
      result.error = (e as Error).message;
    }
    results.push(result);
  }

  // Sweep all duplicates (same title, any combination of manual/synced).
  await dedupeMovies(session.workspaceId);

  revalidatePath("/movies");
  return { results, total: { inserted: totalInserted, updated: totalUpdated } };
}

