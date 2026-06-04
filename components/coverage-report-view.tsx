import Image from "next/image";
import {
  ThumbsUp,
  ThumbsDown,
  Minus,
  ExternalLink,
  Film,
} from "lucide-react";

type CoverageItem = {
  id: string;
  outlet: string | null;
  headline: string | null;
  url: string | null;
  publishedAt: Date | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  notes: string | null;
};

type MovieInfo = {
  title: string;
  logline: string | null;
  director: string | null;
  releaseDate: Date | null;
  posterUrl: string | null;
  genres: string[];
  distributor: string | null;
};

const SENTIMENT_CONFIG = {
  positive: {
    label: "Positive",
    icon: ThumbsUp,
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    count: "text-emerald-700 dark:text-emerald-400",
  },
  neutral: {
    label: "Neutral",
    icon: Minus,
    pill: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    count: "text-zinc-600 dark:text-zinc-400",
  },
  negative: {
    label: "Negative",
    icon: ThumbsDown,
    pill: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    count: "text-red-700 dark:text-red-400",
  },
} as const;

function SentimentPill({ sentiment }: { sentiment: CoverageItem["sentiment"] }) {
  if (!sentiment) return null;
  const cfg = SENTIMENT_CONFIG[sentiment];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.pill}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function fmt(d: Date | null) {
  if (!d) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function CoverageReportView({
  movie,
  coverage,
  generatedAt,
}: {
  movie: MovieInfo;
  coverage: CoverageItem[];
  generatedAt?: Date;
}) {
  const counts = {
    positive: coverage.filter((c) => c.sentiment === "positive").length,
    neutral: coverage.filter((c) => c.sentiment === "neutral").length,
    negative: coverage.filter((c) => c.sentiment === "negative").length,
    none: coverage.filter((c) => !c.sentiment).length,
  };

  return (
    <div className="space-y-8 print:space-y-6">
      {/* Film header */}
      <div className="flex gap-6 print:gap-4">
        {movie.posterUrl ? (
          <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-lg shadow-md print:h-28 print:w-20">
            <Image src={movie.posterUrl} alt={movie.title} fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="flex h-36 w-24 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <Film className="h-8 w-8 text-zinc-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight print:text-xl">{movie.title}</h1>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">
            {movie.director && <span>Dir. {movie.director}</span>}
            {movie.releaseDate && <span>{fmt(movie.releaseDate)}</span>}
            {movie.distributor && <span>{movie.distributor}</span>}
            {movie.genres.slice(0, 3).map((g) => (
              <span key={g} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{g}</span>
            ))}
          </div>
          {movie.logline && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 print:line-clamp-none">
              {movie.logline}
            </p>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 print:grid-cols-4">
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900 print:border print:border-zinc-200 print:p-3">
          <div className="text-2xl font-bold print:text-xl">{coverage.length}</div>
          <div className="mt-0.5 text-xs text-zinc-500">Total coverage</div>
        </div>
        {(["positive", "neutral", "negative"] as const).map((s) => {
          const cfg = SENTIMENT_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <div key={s} className="rounded-xl border border-zinc-200/80 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900 print:border print:border-zinc-200 print:p-3">
              <div className={`text-2xl font-bold print:text-xl ${cfg.count}`}>{counts[s]}</div>
              <div className="mt-0.5 flex items-center justify-center gap-1 text-xs text-zinc-500">
                <Icon className="h-3 w-3" />{cfg.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Coverage list */}
      {coverage.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No coverage logged yet.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-900 print:border-zinc-200">
          {coverage.map((c) => (
            <div key={c.id} className="flex items-start gap-4 px-5 py-4 print:py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {c.outlet && (
                    <span className="font-semibold text-sm">{c.outlet}</span>
                  )}
                  {c.publishedAt && (
                    <span className="text-xs text-zinc-400">{fmt(c.publishedAt)}</span>
                  )}
                  <SentimentPill sentiment={c.sentiment} />
                </div>
                {c.headline && (
                  c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex items-center gap-1 text-sm text-zinc-700 hover:underline dark:text-zinc-300 print:text-zinc-800"
                    >
                      {c.headline}
                      <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400 print:hidden" />
                    </a>
                  ) : (
                    <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">{c.headline}</p>
                  )
                )}
                {c.notes && (
                  <p className="mt-1 text-xs text-zinc-400 italic">{c.notes}</p>
                )}
              </div>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 shrink-0 text-zinc-400 hover:text-zinc-600 print:hidden"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-zinc-400 print:mt-8">
        {generatedAt
          ? `Generated ${generatedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
          : `Generated ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`}
      </p>
    </div>
  );
}
