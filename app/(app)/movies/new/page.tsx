import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { getBrandsForWorkspace } from "@/lib/brand-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMovie } from "../actions";

export default async function NewMoviePage() {
  const session = await requireSession();
  const brands = await getBrandsForWorkspace(session.workspaceId);

  async function submit(formData: FormData) {
    "use server";
    await createMovie(formData);
    redirect("/movies");
  }

  return (
    <>
      <PageHeader title="New movie" description="Add a film project." />
      <div className="mx-auto max-w-2xl p-8">
        <div className="mb-6">
          <Link
            href="/movies"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" /> Back to movies
          </Link>
        </div>
        <form
          action={submit}
          className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="brandId">Brand (production / label)</Label>
            <select
              id="brandId"
              name="brandId"
              className="rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">— No brand —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="releaseDate">Release date</Label>
              <Input id="releaseDate" name="releaseDate" type="date" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue="in_production"
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
              <Input id="distributor" name="distributor" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mpaaRating">MPAA rating</Label>
              <select
                id="mpaaRating"
                name="mpaaRating"
                className="rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                defaultValue=""
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

          <div className="grid gap-1.5">
            <Label htmlFor="posterUrl">Poster URL</Label>
            <Input id="posterUrl" name="posterUrl" type="url" placeholder="https://…" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="synopsis">Synopsis</Label>
            <textarea
              id="synopsis"
              name="synopsis"
              rows={4}
              className="rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="manageSocials"
              defaultChecked
              className="accent-red-600"
            />
            We manage social media for this title
          </label>

          <div className="flex gap-2">
            <Button type="submit">Create movie</Button>
            <Button asChild variant="outline">
              <Link href="/movies">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
