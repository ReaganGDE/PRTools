import Link from "next/link";
import Image from "next/image";
import { eq, desc, and, asc, sql, lte, isNotNull } from "drizzle-orm";
import { Plus, Film, Calendar, LayoutGrid, List, EyeOff, Eye } from "lucide-react";
import { db } from "@/lib/db";
import { movies, brands, workspaces } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { getActiveBrandId, getBrandsForWorkspace } from "@/lib/brand-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SyncFromAirtableButton } from "./sync-button";

type View = "grid" | "list";
type StatusFilter = "all" | "in_production" | "pre_release" | "released" | "archived";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  in_production: "In production",
  pre_release: "Pre-release",
  released: "Released",
  archived: "Archived",
};

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; hideUnreleased?: string }>;
}) {
  const session = await requireSession();
  const activeBrandId = await getActiveBrandId();
  const sp = await searchParams;
  const view: View = sp.view === "list" ? "list" : "grid";
  const statusFilter: StatusFilter =
    (["in_production", "pre_release", "released", "archived"].includes(sp.status ?? "")
      ? sp.status
      : "all") as StatusFilter;
  const hideUnreleased = sp.hideUnreleased === "1";

  const baseCond = activeBrandId
    ? and(eq(movies.workspaceId, session.workspaceId), eq(movies.brandId, activeBrandId))
    : eq(movies.workspaceId, session.workspaceId);

  const conds = [baseCond];
  if (statusFilter !== "all") {
    conds.push(
      eq(
        movies.status,
        statusFilter as "in_production" | "pre_release" | "released" | "archived",
      ),
    );
  }
  if (hideUnreleased) {
    // "Released" = has a release date that is today or in the past.
    conds.push(isNotNull(movies.releaseDate));
    conds.push(lte(movies.releaseDate, new Date()));
  }
  const where = and(...conds);

  const [rows, brandList, [ws]] = await Promise.all([
    db
      .select({
        movie: movies,
        brandName: brands.name,
        brandColor: brands.color,
      })
      .from(movies)
      .leftJoin(brands, eq(brands.id, movies.brandId))
      .where(where)
      // Most recent release first, null dates at the end
      .orderBy(
        sql`${movies.releaseDate} IS NULL ASC`,
        desc(movies.releaseDate),
        asc(movies.title),
      ),
    getBrandsForWorkspace(session.workspaceId),
    db
      .select({
        token: workspaces.airtableToken,
        baseId: workspaces.airtableBaseId,
      })
      .from(workspaces)
      .where(eq(workspaces.id, session.workspaceId)),
  ]);

  const airtableReady =
    !!ws?.token && !!ws?.baseId && brandList.some((b) => b.airtableTableId);

  return (
    <>
      <PageHeader
        title="Movies"
        description="Film projects and release campaigns."
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle current={view} statusFilter={statusFilter} hideUnreleased={hideUnreleased} />
            {airtableReady && <SyncFromAirtableButton />}
            <Button asChild>
              <Link href="/movies/new">
                <Plus className="h-4 w-4" /> New movie
              </Link>
            </Button>
          </div>
        }
      />
      <div className="p-8">
        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => {
            const params = new URLSearchParams();
            if (view !== "grid") params.set("view", view);
            if (s !== "all") params.set("status", s);
            if (hideUnreleased) params.set("hideUnreleased", "1");
            const href = `/movies${params.toString() ? `?${params}` : ""}`;
            return (
              <Link
                key={s}
                href={href}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === s
                    ? s === "released"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : s === "pre_release"
                        ? "border-amber-500 bg-amber-500 text-white"
                        : s === "in_production"
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900",
                )}
              >
                {STATUS_LABELS[s]}
              </Link>
            );
          })}

          {/* Hide unreleased toggle */}
          <HideUnreleasedToggle
            view={view}
            statusFilter={statusFilter}
            active={hideUnreleased}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState hasBrands={brandList.length > 0} />
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((r) => (
              <MovieCard
                key={r.movie.id}
                movie={r.movie}
                brandName={r.brandName}
                brandColor={r.brandColor}
              />
            ))}
          </div>
        ) : (
          <MoviesListView rows={rows} />
        )}
      </div>
    </>
  );
}

function HideUnreleasedToggle({
  view,
  statusFilter,
  active,
}: {
  view: View;
  statusFilter: StatusFilter;
  active: boolean;
}) {
  const params = new URLSearchParams();
  if (view !== "grid") params.set("view", view);
  if (statusFilter !== "all") params.set("status", statusFilter);
  // Toggling: keep current filters, flip the flag.
  if (!active) params.set("hideUnreleased", "1");
  const href = `/movies${params.toString() ? `?${params}` : ""}`;

  return (
    <Link
      href={href}
      title={
        active
          ? "Showing only released movies — click to show all"
          : "Hide movies that aren't released yet"
      }
      className={cn(
        "ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-red-500 bg-red-500 text-white"
          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900",
      )}
    >
      {active ? (
        <EyeOff className="h-3.5 w-3.5" />
      ) : (
        <Eye className="h-3.5 w-3.5" />
      )}
      Hide unreleased
    </Link>
  );
}

function ViewToggle({
  current,
  statusFilter,
  hideUnreleased,
}: {
  current: View;
  statusFilter: StatusFilter;
  hideUnreleased: boolean;
}) {
  const base =
    "flex h-9 items-center gap-1.5 border border-zinc-200 px-3 text-sm font-medium transition-colors dark:border-zinc-800";
  function hrefFor(v: View) {
    const params = new URLSearchParams();
    if (v !== "grid") params.set("view", v);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (hideUnreleased) params.set("hideUnreleased", "1");
    return `/movies${params.toString() ? `?${params}` : ""}`;
  }
  return (
    <div className="flex overflow-hidden rounded-lg">
      <Link
        href={hrefFor("grid")}
        className={cn(
          base,
          "rounded-l-lg border-r-0",
          current === "grid"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Grid
      </Link>
      <Link
        href={hrefFor("list")}
        className={cn(
          base,
          "rounded-r-lg",
          current === "list"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800",
        )}
      >
        <List className="h-3.5 w-3.5" /> List
      </Link>
    </div>
  );
}

function MoviesListView({
  rows,
}: {
  rows: {
    movie: typeof movies.$inferSelect;
    brandName: string | null;
    brandColor: string | null;
  }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50/50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
          <tr>
            <th className="w-12 px-3 py-2.5"></th>
            <th className="px-3 py-2.5 font-semibold">Title</th>
            <th className="px-3 py-2.5 font-semibold">Brand</th>
            <th className="px-3 py-2.5 font-semibold">Studio</th>
            <th className="px-3 py-2.5 font-semibold">Genre</th>
            <th className="px-3 py-2.5 font-semibold">Director</th>
            <th className="px-3 py-2.5 font-semibold">Runtime</th>
            <th className="px-3 py-2.5 font-semibold">Rights</th>
            <th className="px-3 py-2.5 font-semibold">Release</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.movie.id}
              className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800/40 dark:hover:bg-zinc-800/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/movies/${r.movie.id}`}
                  className="relative block aspect-[2/3] w-9 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800"
                >
                  {r.movie.posterUrl ? (
                    <Image
                      src={r.movie.posterUrl}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <Film className="absolute inset-0 m-auto h-3.5 w-3.5 text-zinc-400" />
                  )}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/movies/${r.movie.id}`}
                  className="font-medium hover:underline"
                >
                  {r.movie.title}
                </Link>
                {r.movie.tagline && (
                  <p className="truncate text-xs text-zinc-500">
                    {r.movie.tagline}
                  </p>
                )}
              </td>
              <td className="px-3 py-2">
                {r.brandName && (
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    {r.brandColor && (
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: r.brandColor }}
                      />
                    )}
                    {r.brandName}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-zinc-500">
                {r.movie.studio ?? "—"}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.movie.genres.slice(0, 2).map((g) => (
                    <span
                      key={g}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800"
                    >
                      {g}
                    </span>
                  ))}
                  {r.movie.genres.length > 2 && (
                    <span className="text-[10px] text-zinc-400">
                      +{r.movie.genres.length - 2}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-zinc-500">
                {r.movie.director ?? "—"}
              </td>
              <td className="px-3 py-2 tabular-nums text-zinc-500">
                {r.movie.runtime ? `${r.movie.runtime}m` : "—"}
              </td>
              <td className="px-3 py-2 text-zinc-500">
                {r.movie.rights ?? "—"}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-500">
                {r.movie.releaseDate
                  ? r.movie.releaseDate.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </td>
              <td className="px-3 py-2">
                <StatusPill status={r.movie.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovieCard({
  movie,
  brandName,
  brandColor,
}: {
  movie: typeof movies.$inferSelect;
  brandName: string | null;
  brandColor: string | null;
}) {
  return (
    <Link
      href={`/movies/${movie.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
      style={
        brandColor
          ? { borderLeftWidth: 3, borderLeftColor: brandColor }
          : undefined
      }
    >
      <div className="relative aspect-[2/3] bg-zinc-100 dark:bg-zinc-900">
        {movie.posterUrl ? (
          <Image
            src={movie.posterUrl}
            alt={movie.title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Film className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          </div>
        )}
        <StatusBadge status={movie.status} />
      </div>
      <div className="space-y-1.5 p-3">
        {brandName && (
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
            {brandColor && (
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: brandColor }}
              />
            )}
            {brandName}
          </div>
        )}
        <h3 className="font-semibold tracking-tight">{movie.title}</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {movie.releaseDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {movie.releaseDate.toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          {movie.runtime && <span>{movie.runtime}m</span>}
          {movie.mpaaRating && (
            <span className="rounded border border-zinc-200 px-1 text-[10px] font-semibold dark:border-zinc-700">
              {movie.mpaaRating}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace("_", " ");
  const cls =
    status === "released"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "pre_release"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : status === "archived"
          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  return (
    <span
      className={cn(
        "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = status.replace("_", " ");
  const cls =
    status === "released"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "pre_release"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : status === "archived"
          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function EmptyState({ hasBrands }: { hasBrands: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-16 text-center dark:border-zinc-700 dark:bg-zinc-900/20">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
        <Film className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold">No movies yet</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Add a film project to track release dates, distribution, and tie social
        posts to a campaign.
      </p>
      {hasBrands ? (
        <Button asChild className="mt-5">
          <Link href="/movies/new">Add your first movie</Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="mt-5">
          <Link href="/brands">Create a brand first</Link>
        </Button>
      )}
    </div>
  );
}
