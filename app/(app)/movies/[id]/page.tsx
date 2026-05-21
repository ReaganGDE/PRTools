import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { ChevronLeft, Film, Calendar, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { movies, brands, socialPosts } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { getBrandsForWorkspace } from "@/lib/brand-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMovie, deleteMovie } from "../actions";
import { cn } from "@/lib/utils";

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [[row], brandList, moviePosts] = await Promise.all([
    db
      .select({ movie: movies, brandName: brands.name, brandColor: brands.color })
      .from(movies)
      .leftJoin(brands, eq(brands.id, movies.brandId))
      .where(
        and(eq(movies.id, id), eq(movies.workspaceId, session.workspaceId)),
      ),
    getBrandsForWorkspace(session.workspaceId),
    db
      .select()
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.movieId, id),
          eq(socialPosts.workspaceId, session.workspaceId),
        ),
      )
      .orderBy(desc(socialPosts.createdAt))
      .limit(10),
  ]);

  if (!row) notFound();
  const movie = row.movie;

  return (
    <>
      <PageHeader
        title={movie.title}
        description={movie.synopsis ?? "Film project"}
      />
      <div className="mx-auto max-w-4xl p-8">
        <div className="mb-6">
          <Link
            href="/movies"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" /> Back to movies
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
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
          </div>

          <form
            action={updateMovie.bind(null, movie.id)}
            className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={movie.title} required />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="brandId">Brand</Label>
              <select
                id="brandId"
                name="brandId"
                defaultValue={movie.brandId ?? ""}
                className="rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">— No brand —</option>
                {brandList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="releaseDate">Release date</Label>
                <Input
                  id="releaseDate"
                  name="releaseDate"
                  type="date"
                  defaultValue={
                    movie.releaseDate
                      ? movie.releaseDate.toISOString().slice(0, 10)
                      : ""
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={movie.status}
                  className="rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="in_production">In production</option>
                  <option value="pre_release">Pre-release</option>
                  <option value="released">Released</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="distributor">Distributor</Label>
                <Input
                  id="distributor"
                  name="distributor"
                  defaultValue={movie.distributor ?? ""}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mpaaRating">MPAA rating</Label>
                <select
                  id="mpaaRating"
                  name="mpaaRating"
                  defaultValue={movie.mpaaRating ?? ""}
                  className="rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="">—</option>
                  <option value="G">G</option>
                  <option value="PG">PG</option>
                  <option value="PG-13">PG-13</option>
                  <option value="R">R</option>
                  <option value="NC-17">NC-17</option>
                  <option value="Unrated">Unrated</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="manageSocials"
                defaultChecked={movie.manageSocials}
                className="accent-red-600"
              />
              We manage social media for this title
            </label>

            <div className="flex gap-2">
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </div>

        {/* Recent posts for this movie */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent posts</h2>
            <Link
              href="/social/new"
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
            >
              New post <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          {moviePosts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No social posts yet for this movie.
            </p>
          ) : (
            <ul className="space-y-2">
              {moviePosts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/social/${p.id}`}
                    className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                        "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
                      )}
                    >
                      {p.platform}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {p.title || p.body}
                    </span>
                    {p.scheduledAt && (
                      <span className="shrink-0 text-[11px] text-zinc-400">
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {p.scheduledAt.toLocaleDateString()}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Delete */}
        <div className="mt-8">
          <form action={deleteMovie.bind(null, movie.id)}>
            <Button
              type="submit"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
            >
              Delete movie
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
