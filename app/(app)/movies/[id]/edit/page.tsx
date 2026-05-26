import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { movies } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { getBrandsForWorkspace } from "@/lib/brand-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMovie, deleteMovie } from "../../actions";

export default async function MovieEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [movie] = await db
    .select()
    .from(movies)
    .where(and(eq(movies.id, id), eq(movies.workspaceId, session.workspaceId)));

  if (!movie) notFound();

  const brandList = await getBrandsForWorkspace(session.workspaceId);

  async function save(formData: FormData) {
    "use server";
    await updateMovie(id, formData);
    redirect(`/movies/${id}`);
  }

  return (
    <>
      <PageHeader title={`Edit: ${movie.title}`} />
      <div className="mx-auto max-w-2xl p-8">
        <div className="mb-6">
          <Link
            href={`/movies/${movie.id}`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        </div>

        <form
          action={save}
          className="grid gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
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
              <Label htmlFor="mpaaRating">Rating</Label>
              <Input
                id="mpaaRating"
                name="mpaaRating"
                defaultValue={movie.mpaaRating ?? ""}
              />
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

          <div>
            <Button type="submit">Save changes</Button>
          </div>
        </form>

        <form
          action={deleteMovie.bind(null, movie.id)}
          className="mt-6 flex justify-end"
        >
          <Button
            type="submit"
            variant="ghost"
            className="text-red-600 hover:text-red-700"
          >
            Delete movie
          </Button>
        </form>
      </div>
    </>
  );
}
