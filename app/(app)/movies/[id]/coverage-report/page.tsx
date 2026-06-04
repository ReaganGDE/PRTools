import { notFound } from "next/navigation";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { movies, movieCoverages } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CoverageReportView } from "@/components/coverage-report-view";
import { ShareControls } from "./share-controls";
import { Printer } from "lucide-react";

export default async function CoverageReportPage({
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

  const coverage = await db
    .select()
    .from(movieCoverages)
    .where(
      and(
        eq(movieCoverages.movieId, id),
        eq(movieCoverages.workspaceId, session.workspaceId),
      ),
    )
    .orderBy(desc(movieCoverages.publishedAt), desc(movieCoverages.createdAt));

  return (
    <>
      <PageHeader
        title="Coverage report"
        description={movie.title}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Link href={`/movies/${id}`}>
              <Button variant="outline" type="button">← Back to film</Button>
            </Link>
            <Button
              variant="outline"
              type="button"
              onClick={undefined}
              // trigger print via a client button — handled below via the inline script
              className="[&]:print:hidden"
              id="print-btn"
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
          </div>
        }
      />

      {/* Print trigger script — tiny inline snippet so no client component needed */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('print-btn')?.addEventListener('click',()=>window.print())`,
        }}
      />

      <div className="mx-auto max-w-4xl space-y-6 p-8 print:p-0">
        {/* Share link controls */}
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 print:hidden">
          <p className="flex-1 text-sm text-zinc-500">
            Share a public link — anyone with the link can view this report (no login required).
          </p>
          <ShareControls movieId={id} initialToken={movie.coverageReportToken ?? null} />
        </div>

        <CoverageReportView
          movie={{
            title: movie.title,
            logline: movie.logline,
            director: movie.director,
            releaseDate: movie.releaseDate,
            posterUrl: movie.posterUrl ?? movie.posterAirtableUrl,
            genres: movie.genres ?? [],
            distributor: movie.distributor,
          }}
          coverage={coverage}
          generatedAt={new Date()}
        />
      </div>
    </>
  );
}
