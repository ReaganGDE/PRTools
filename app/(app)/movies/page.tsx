import Link from "next/link";
import Image from "next/image";
import { eq, desc, and } from "drizzle-orm";
import { Plus, Film, Calendar } from "lucide-react";
import { db } from "@/lib/db";
import { movies, brands } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { getActiveBrandId, getBrandsForWorkspace } from "@/lib/brand-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function MoviesPage() {
  const session = await requireSession();
  const activeBrandId = await getActiveBrandId();

  const where = activeBrandId
    ? and(eq(movies.workspaceId, session.workspaceId), eq(movies.brandId, activeBrandId))
    : eq(movies.workspaceId, session.workspaceId);

  const [rows, brandList] = await Promise.all([
    db
      .select({
        movie: movies,
        brandName: brands.name,
        brandColor: brands.color,
      })
      .from(movies)
      .leftJoin(brands, eq(brands.id, movies.brandId))
      .where(where)
      .orderBy(desc(movies.createdAt)),
    getBrandsForWorkspace(session.workspaceId),
  ]);

  return (
    <>
      <PageHeader
        title="Movies"
        description="Film projects and release campaigns."
        actions={
          <Button asChild>
            <Link href="/movies/new">
              <Plus className="h-4 w-4" /> New movie
            </Link>
          </Button>
        }
      />
      <div className="p-8">
        {rows.length === 0 ? (
          <EmptyState hasBrands={brandList.length > 0} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <MovieCard
                key={r.movie.id}
                movie={r.movie}
                brandName={r.brandName}
                brandColor={r.brandColor}
              />
            ))}
          </div>
        )}
      </div>
    </>
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
          {movie.mpaaRating && (
            <span className="rounded border border-zinc-200 px-1 text-[10px] font-semibold dark:border-zinc-700">
              {movie.mpaaRating}
            </span>
          )}
          {!movie.manageSocials && (
            <span className="text-[10px] italic">socials not managed</span>
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
