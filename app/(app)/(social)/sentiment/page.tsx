import Link from "next/link";
import { and, eq, desc, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mentions, keywords } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SOURCE_LABELS: Record<string, string> = {
  news: "News",
  reddit: "Reddit",
  youtube: "YouTube",
  tiktok: "TikTok",
};

function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

export default async function SentimentPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; label?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const since = thirtyDaysAgo();

  const conds = [
    eq(mentions.workspaceId, session.workspaceId),
    gte(mentions.createdAt, since),
  ];
  if (sp.source && ["news", "reddit", "youtube"].includes(sp.source)) {
    conds.push(eq(mentions.source, sp.source as "news" | "reddit" | "youtube"));
  }
  if (sp.label && ["negative", "neutral", "positive"].includes(sp.label)) {
    conds.push(
      eq(
        mentions.sentimentLabel,
        sp.label as "negative" | "neutral" | "positive",
      ),
    );
  }

  // Aggregate counts by label for headline stats
  const counts = await db
    .select({
      label: mentions.sentimentLabel,
      value: sql<number>`count(*)::int`,
    })
    .from(mentions)
    .where(
      and(
        eq(mentions.workspaceId, session.workspaceId),
        gte(mentions.createdAt, since),
      ),
    )
    .groupBy(mentions.sentimentLabel);

  // Aggregate counts by source
  const bySource = await db
    .select({
      source: mentions.source,
      value: sql<number>`count(*)::int`,
    })
    .from(mentions)
    .where(
      and(
        eq(mentions.workspaceId, session.workspaceId),
        gte(mentions.createdAt, since),
      ),
    )
    .groupBy(mentions.source);

  // 8-week sentiment trend (by ISO week, positive/neutral/negative counts).
  const eightWeeksAgo = new Date(
    Date.now() - 8 * 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const trend = (await db.execute(sql`
    SELECT to_char(date_trunc('week', coalesce(published_at, created_at)), 'Mon DD') AS week,
           count(*) FILTER (WHERE sentiment_label = 'positive')::int AS positive,
           count(*) FILTER (WHERE sentiment_label = 'neutral')::int AS neutral,
           count(*) FILTER (WHERE sentiment_label = 'negative')::int AS negative,
           count(*)::int AS total
    FROM mentions
    WHERE workspace_id = ${session.workspaceId}
      AND coalesce(published_at, created_at) >= ${eightWeeksAgo}
    GROUP BY date_trunc('week', coalesce(published_at, created_at))
    ORDER BY date_trunc('week', coalesce(published_at, created_at)) ASC
  `)) as unknown as {
    week: string;
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  }[];
  const trendMax = Math.max(1, ...trend.map((t) => t.total));

  const recent = await db
    .select()
    .from(mentions)
    .where(and(...conds))
    .orderBy(desc(mentions.publishedAt))
    .limit(50);

  // Active keywords for context
  const activeKeywords = await db
    .select()
    .from(keywords)
    .where(
      and(
        eq(keywords.workspaceId, session.workspaceId),
        eq(keywords.active, true),
      ),
    );

  const labelStat = (l: string) =>
    counts.find((c) => c.label === l)?.value ?? 0;

  return (
    <>
      <PageHeader
        title="Sentiment"
        description={`Last 30 days · ${activeKeywords.length} keywords tracked`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/api/export/mentions?days=30">Export CSV</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/keywords">Manage keywords</Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-6 p-8 lg:grid-cols-4">
        {activeKeywords.length === 0 ? (
          <Card className="lg:col-span-4">
            <CardContent className="p-8 text-center">
              <p className="mb-4 text-sm text-zinc-500">
                No keywords being tracked yet.
              </p>
              <Button asChild>
                <Link href="/settings/keywords">Add your first keyword</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <SentimentCard label="Positive" value={labelStat("positive")} color="green" />
        <SentimentCard label="Neutral" value={labelStat("neutral")} color="zinc" />
        <SentimentCard label="Negative" value={labelStat("negative")} color="red" />
        <SentimentCard
          label="Unscored"
          value={counts.find((c) => c.label === null)?.value ?? 0}
          color="amber"
        />

        {trend.some((t) => t.total > 0) && (
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-base">Sentiment over time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 sm:gap-3">
                {trend.map((t) => (
                  <div key={t.week} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className="flex w-full max-w-[48px] flex-col-reverse overflow-hidden rounded-md"
                      style={{ height: 120 }}
                      title={`${t.week}: ${t.positive}+ / ${t.neutral}~ / ${t.negative}−`}
                    >
                      {/* bars stack from bottom; heights proportional to max total */}
                      <div
                        className="w-full bg-green-500/80"
                        style={{ height: `${(t.positive / trendMax) * 100}%` }}
                      />
                      <div
                        className="w-full bg-zinc-400/70"
                        style={{ height: `${(t.neutral / trendMax) * 100}%` }}
                      />
                      <div
                        className="w-full bg-red-500/80"
                        style={{ height: `${(t.negative / trendMax) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400">{t.week}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /> Positive</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-400" /> Neutral</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Negative</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Mentions by source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["news", "reddit", "youtube"] as const).map((s) => {
                const v = bySource.find((r) => r.source === s)?.value ?? 0;
                return (
                  <Link
                    key={s}
                    href={`/sentiment?source=${s}`}
                    className="flex items-center justify-between rounded-md border border-zinc-200 p-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <span>{SOURCE_LABELS[s]}</span>
                    <span className="font-semibold">{v}</span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              Recent mentions
            </h2>
            <div className="ml-auto flex gap-2">
              {sp.source || sp.label ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/sentiment">Clear filters</Link>
                </Button>
              ) : null}
              {(["positive", "neutral", "negative"] as const).map((l) => (
                <Link
                  key={l}
                  href={`/sentiment?label=${l}`}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    sp.label === l
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                  }`}
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>

          {recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500">
                No mentions yet. Polling runs hourly — or click &quot;Poll now&quot; on
                the Keywords page.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {recent.map((m) => (
                <li
                  key={m.id}
                  className="rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        {m.title ?? m.url}
                      </a>
                      <div className="mt-1 text-xs text-zinc-500">
                        {SOURCE_LABELS[m.source]} ·{" "}
                        {m.author ?? "—"} ·{" "}
                        {m.keywordMatched
                          ? `matched "${m.keywordMatched}"`
                          : ""}
                        {m.publishedAt
                          ? ` · ${m.publishedAt.toLocaleDateString()}`
                          : ""}
                      </div>
                      {m.body ? (
                        <p className="mt-2 line-clamp-2 text-zinc-600 dark:text-zinc-300">
                          {m.body}
                        </p>
                      ) : null}
                    </div>
                    <SentimentPill
                      label={m.sentimentLabel}
                      score={m.sentimentScore}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function SentimentCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "red" | "zinc" | "amber";
}) {
  const colors = {
    green: "text-green-700 dark:text-green-300",
    red: "text-red-700 dark:text-red-300",
    zinc: "text-zinc-700 dark:text-zinc-300",
    amber: "text-amber-700 dark:text-amber-300",
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium ${colors[color]}`}>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function SentimentPill({
  label,
  score,
}: {
  label: string | null;
  score: number | null;
}) {
  if (!label) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        unscored
      </span>
    );
  }
  const cls =
    label === "positive"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
      : label === "negative"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
        : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cls}`}>
      {label}
      {score != null ? ` · ${score.toFixed(2)}` : ""}
    </span>
  );
}
