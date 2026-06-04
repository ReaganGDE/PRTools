import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { movies, movieCoverages } from "@/lib/db/schema";
import { CoverageReportView } from "@/components/coverage-report-view";
import { Printer } from "lucide-react";

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [movie] = await db
    .select()
    .from(movies)
    .where(eq(movies.coverageReportToken, token));

  if (!movie) notFound();

  const coverage = await db
    .select()
    .from(movieCoverages)
    .where(eq(movieCoverages.movieId, movie.id))
    .orderBy(desc(movieCoverages.publishedAt), desc(movieCoverages.createdAt));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-10 print:py-0">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <p className="text-xs text-zinc-400">Press coverage report</p>
          <button
            id="print-btn"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save as PDF
          </button>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `document.getElementById('print-btn')?.addEventListener('click',()=>window.print())`,
          }}
        />

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
    </div>
  );
}
