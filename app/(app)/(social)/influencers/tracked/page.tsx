import Image from "next/image";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  Users,
  Eye,
  Heart,
  RefreshCw,
  Trash2,
  Radio,
  Check,
  ExternalLink,
  Video,
  Camera,
  Music2,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  trackedInfluencers,
  influencerSnapshots,
  keywords,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { requireSectionAccess } from "@/lib/tool-access";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { InfluencerTabs } from "../tabs";
import {
  refreshAllMetrics,
  untrackInfluencer,
  listenToInfluencer,
} from "./actions";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Delta({ now, prev }: { now: number; prev: number | null }) {
  if (prev == null || prev === now) return null;
  const diff = now - prev;
  const up = diff > 0;
  return (
    <span
      className={
        "ml-1 text-[11px] font-medium " +
        (up
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400")
      }
    >
      {up ? "▲" : "▼"} {fmt(Math.abs(diff))}
    </span>
  );
}

const PLATFORM_ICONS = {
  youtube: Video,
  instagram: Camera,
  tiktok: Music2,
} as const;

export default async function TrackedInfluencersPage() {
  await requireSectionAccess("social");
  const session = await requireSession();

  const tracked = await db
    .select()
    .from(trackedInfluencers)
    .where(eq(trackedInfluencers.workspaceId, session.workspaceId))
    .orderBy(asc(trackedInfluencers.createdAt));

  const snapshotsById = new Map<
    string,
    (typeof influencerSnapshots.$inferSelect)[]
  >();
  if (tracked.length > 0) {
    const snaps = await db
      .select()
      .from(influencerSnapshots)
      .where(
        inArray(
          influencerSnapshots.trackedInfluencerId,
          tracked.map((t) => t.id),
        ),
      )
      .orderBy(asc(influencerSnapshots.capturedAt));
    for (const s of snaps) {
      const list = snapshotsById.get(s.trackedInfluencerId) ?? [];
      list.push(s);
      snapshotsById.set(s.trackedInfluencerId, list);
    }
  }

  // Which tracked names already have an active listening keyword.
  const activeKeywords = await db
    .select({ term: keywords.term })
    .from(keywords)
    .where(
      and(
        eq(keywords.workspaceId, session.workspaceId),
        eq(keywords.active, true),
      ),
    );
  const listening = new Set(activeKeywords.map((k) => k.term.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Tracked influencers"
        description="Follower growth and engagement over time for the creators you're monitoring."
      />
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <InfluencerTabs />
          {tracked.length > 0 && (
            <form action={refreshAllMetrics}>
              <Button type="submit" size="sm" variant="outline">
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh metrics
              </Button>
            </form>
          )}
        </div>

        {tracked.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No tracked influencers yet. Use the{" "}
            <Link href="/influencers/analyze" className="underline">
              Analyze
            </Link>{" "}
            tab to look someone up, then hit <strong>Track</strong>.
          </p>
        ) : (
          <div className="space-y-3">
            {tracked.map((t) => {
              const snaps = snapshotsById.get(t.id) ?? [];
              const latest = snaps[snaps.length - 1] ?? null;
              const previous =
                snaps.length > 1 ? snaps[snaps.length - 2] : null;
              const first = snaps[0] ?? null;
              const isListening = listening.has(t.name.toLowerCase());
              const PlatformIcon =
                PLATFORM_ICONS[t.platform as keyof typeof PLATFORM_ICONS] ??
                Video;
              const sinceTracked =
                first && latest && first.id !== latest.id
                  ? latest.followers - first.followers
                  : null;
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      {t.thumbnail ? (
                        <Image
                          src={t.thumbnail}
                          alt={t.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <PlatformIcon className="h-5 w-5 text-zinc-400" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-medium hover:underline"
                        >
                          {t.name}
                        </a>
                        <PlatformIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-zinc-600"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {t.handle ? `${t.handle} · ` : ""}
                        tracking since {t.createdAt.toLocaleDateString()}
                        {latest &&
                          ` · last refreshed ${latest.capturedAt.toLocaleDateString()}`}
                      </p>
                      {latest && (
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {fmt(latest.followers)} followers
                            <Delta
                              now={latest.followers}
                              prev={previous?.followers ?? null}
                            />
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {fmt(latest.avgViews)} avg views
                            <Delta
                              now={latest.avgViews}
                              prev={previous?.avgViews ?? null}
                            />
                          </span>
                          <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <Heart className="h-3 w-3" />
                            {latest.engagementRate}% engagement
                          </span>
                          {sinceTracked != null && sinceTracked !== 0 && (
                            <span className="text-zinc-400">
                              {sinceTracked > 0 ? "+" : ""}
                              {fmt(Math.abs(sinceTracked))} followers since
                              tracked
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {isListening ? (
                        <span
                          className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                          title="Mentions of this creator are being collected on the Sentiment page"
                        >
                          <Check className="h-3.5 w-3.5" /> Listening
                        </span>
                      ) : (
                        <form action={listenToInfluencer.bind(null, t.id)}>
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            title="Add as a listening keyword — mentions will appear on the Sentiment page"
                          >
                            <Radio className="h-3.5 w-3.5" />
                            Listen
                          </Button>
                        </form>
                      )}
                      <form action={untrackInfluencer.bind(null, t.id)}>
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          title="Stop tracking"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>

                  {/* Metric history */}
                  {snaps.length > 1 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                        History ({snaps.length} snapshots)
                      </summary>
                      <table className="mt-2 w-full text-xs">
                        <thead className="border-b border-zinc-100 text-left text-zinc-500 dark:border-zinc-800">
                          <tr>
                            <th className="py-1 pr-3 font-medium">Date</th>
                            <th className="py-1 pr-3 font-medium">Followers</th>
                            <th className="py-1 pr-3 font-medium">Avg views</th>
                            <th className="py-1 pr-3 font-medium">Avg likes</th>
                            <th className="py-1 pr-3 font-medium">
                              Avg comments
                            </th>
                            <th className="py-1 font-medium">Engagement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...snaps].reverse().map((s) => (
                            <tr
                              key={s.id}
                              className="border-b border-zinc-50 dark:border-zinc-900"
                            >
                              <td className="py-1 pr-3">
                                {s.capturedAt.toLocaleDateString()}
                              </td>
                              <td className="py-1 pr-3">{fmt(s.followers)}</td>
                              <td className="py-1 pr-3">{fmt(s.avgViews)}</td>
                              <td className="py-1 pr-3">{fmt(s.avgLikes)}</td>
                              <td className="py-1 pr-3">
                                {fmt(s.avgComments)}
                              </td>
                              <td className="py-1">{s.engagementRate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-zinc-400">
          Hit <strong>Refresh metrics</strong> periodically (e.g. weekly) to
          build up growth history. <strong>Listen</strong> adds the creator as a
          keyword on the{" "}
          <Link href="/sentiment" className="underline">
            Sentiment
          </Link>{" "}
          page so mentions of them across news, Reddit, and YouTube are
          collected and scored automatically.
        </p>
      </div>
    </>
  );
}
