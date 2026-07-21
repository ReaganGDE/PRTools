"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import {
  Search,
  Video,
  Camera,
  Music2,
  Users,
  Eye,
  Heart,
  MessageSquare,
  ExternalLink,
  Info,
  Check,
  LineChart,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  analyzeInfluencer,
  trackInfluencer,
  type AnalyzeResult,
} from "./actions";
import { addInfluencerContact } from "../actions";

const PLATFORMS = [
  { id: "youtube", label: "YouTube", icon: Video },
  { id: "instagram", label: "Instagram", icon: Camera },
  { id: "tiktok", label: "TikTok", icon: Music2 },
] as const;

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function EngagementAnalyzer({
  youtubeEnabled,
  modashEnabled,
}: {
  youtubeEnabled: boolean;
  modashEnabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<string>("youtube");
  const [data, setData] = useState<AnalyzeResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [trackState, setTrackState] = useState<"idle" | "saving" | "done" | "dupe">("idle");
  const [contactState, setContactState] = useState<"idle" | "saving" | "done" | "dupe">("idle");

  function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const fd = new FormData();
    fd.set("query", query.trim());
    fd.set("platform", platform);
    startTransition(async () => {
      const r = await analyzeInfluencer(fd);
      setData(r);
      setTrackState(r.alreadyTracked ? "dupe" : "idle");
      setContactState("idle");
    });
  }

  function handleTrack() {
    const a = data?.analysis;
    if (!a) return;
    setTrackState("saving");
    const fd = new FormData();
    fd.set("platform", a.platform);
    fd.set("externalId", a.externalId);
    fd.set("name", a.name);
    if (a.handle) fd.set("handle", a.handle);
    fd.set("url", a.url);
    if (a.thumbnail) fd.set("thumbnail", a.thumbnail);
    fd.set("followers", String(a.followers));
    fd.set("avgViews", String(a.avgViews));
    fd.set("avgLikes", String(a.avgLikes));
    fd.set("avgComments", String(a.avgComments));
    fd.set("engagementRate", String(a.engagementRate));
    startTransition(async () => {
      const r = await trackInfluencer(fd);
      setTrackState(r.tracked ? "done" : "dupe");
    });
  }

  function handleAddContact() {
    const a = data?.analysis;
    if (!a) return;
    setContactState("saving");
    const fd = new FormData();
    fd.set("platform", a.platform);
    fd.set("name", a.name);
    if (a.handle) fd.set("handle", a.handle);
    fd.set("url", a.url);
    fd.set("followers", String(a.followers));
    fd.set("avgViews", String(a.avgViews));
    fd.set("engagementRate", String(a.engagementRate));
    startTransition(async () => {
      const r = await addInfluencerContact(fd);
      setContactState(r.added ? "done" : "dupe");
    });
  }

  const a = data?.analysis;

  return (
    <div className="space-y-6">
      <form onSubmit={handleAnalyze} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paste a channel URL, @handle, or name — e.g. '@mkbhd' or a profile link"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <Button type="submit" disabled={isPending || !query.trim()}>
            <Search className="h-4 w-4" />
            {isPending ? "Analyzing…" : "Analyze"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const active = platform === p.id;
            const locked =
              p.id === "youtube" ? !youtubeEnabled : !modashEnabled;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                title={
                  locked
                    ? p.id === "youtube"
                      ? "Requires YOUTUBE_API_KEY"
                      : "Requires a Modash/HypeAuditor key (MODASH_API_KEY)"
                    : undefined
                }
                className={
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                  (active
                    ? "border-red-500 bg-red-50 text-red-700 dark:border-red-500/60 dark:bg-red-950/30 dark:text-red-300"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400") +
                  (locked ? " opacity-60" : "")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {p.label}
                {locked && <span className="text-[10px]">🔒</span>}
              </button>
            );
          })}
        </div>
      </form>

      {data?.notes && data.notes.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <ul className="space-y-0.5">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {a && (
        <>
          {/* Profile header */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              {a.thumbnail ? (
                <Image src={a.thumbnail} alt={a.name} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Users className="h-6 w-6 text-zinc-400" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-lg font-semibold hover:underline"
                >
                  {a.name}
                </a>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              {a.handle && <p className="text-sm text-zinc-500">{a.handle}</p>}
              {a.description && (
                <p className="mt-1 line-clamp-2 max-w-xl text-xs text-zinc-500">
                  {a.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {trackState === "done" || trackState === "dupe" ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  {trackState === "done" ? "Tracking" : "Already tracked"}
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleTrack}
                  disabled={trackState === "saving"}
                >
                  <LineChart className="h-3.5 w-3.5" />
                  {trackState === "saving" ? "Saving…" : "Track"}
                </Button>
              )}
              {contactState === "done" ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> In contacts
                </span>
              ) : contactState === "dupe" ? (
                <span className="text-xs text-zinc-400">Already a contact</span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddContact}
                  disabled={contactState === "saving"}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {contactState === "saving" ? "Adding…" : "Add contact"}
                </Button>
              )}
            </div>
          </div>

          {/* Headline metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Followers" value={fmt(a.followers)} icon={Users} />
            <Stat
              label="Engagement rate"
              value={`${a.engagementRate}%`}
              icon={Heart}
              highlight
            />
            <Stat label="Avg views" value={fmt(a.avgViews)} icon={Eye} />
            <Stat label="Avg likes" value={fmt(a.avgLikes)} icon={Heart} />
            <Stat
              label="Avg comments"
              value={fmt(a.avgComments)}
              icon={MessageSquare}
            />
          </div>

          {/* Recent content breakdown */}
          {a.posts.length > 0 && (
            <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">
                  Recent content ({a.posts.length})
                </h3>
                <p className="text-xs text-zinc-500">
                  Per-post engagement = (likes + comments) ÷ views.
                </p>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {a.posts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm"
                  >
                    {p.thumbnail && (
                      <div className="relative h-9 w-16 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                        <Image
                          src={p.thumbnail}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="line-clamp-1 hover:underline"
                        >
                          {p.title}
                        </a>
                      ) : (
                        <span className="line-clamp-1">{p.title}</span>
                      )}
                      {p.publishedAt && (
                        <span className="text-xs text-zinc-400">
                          {new Date(p.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {fmt(p.views)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {fmt(p.likes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {fmt(p.comments)}
                      </span>
                      <span
                        className={
                          "w-14 text-right font-medium " +
                          (p.engagementRate >= a.engagementRate
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-zinc-500")
                        }
                      >
                        {p.engagementRate}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div
        className={
          "mt-1 text-xl font-semibold " +
          (highlight ? "text-emerald-600 dark:text-emerald-400" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
