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
  UserPlus,
  Check,
  ExternalLink,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  searchInfluencers,
  addInfluencerContact,
  type InfluencerSearchResult,
} from "./actions";
import type { InfluencerResult } from "@/lib/integrations/youtube-influencers";

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

export function InfluencerFinder({
  youtubeEnabled,
  modashEnabled,
}: {
  youtubeEnabled: boolean;
  modashEnabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(["youtube"]));
  const [data, setData] = useState<InfluencerSearchResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState<Record<string, "adding" | "done" | "dupe">>({});

  function togglePlatform(id: string) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const fd = new FormData();
    fd.set("query", query.trim());
    for (const p of platforms) fd.append("platforms", p);
    startTransition(async () => {
      const r = await searchInfluencers(fd);
      setData(r);
      setAdded({});
    });
  }

  function handleAdd(r: InfluencerResult) {
    const key = `${r.platform}:${r.channelId}`;
    setAdded((prev) => ({ ...prev, [key]: "adding" }));
    const fd = new FormData();
    fd.set("platform", r.platform);
    fd.set("name", r.name);
    if (r.handle) fd.set("handle", r.handle);
    fd.set("url", r.url);
    fd.set("followers", String(r.subscribers));
    fd.set("avgViews", String(r.avgViews));
    fd.set("engagementRate", String(r.engagementRate));
    startTransition(async () => {
      const res = await addInfluencerContact(fd);
      setAdded((prev) => ({
        ...prev,
        [key]: res.added ? "done" : "dupe",
      }));
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Niche or topic — e.g. 'indie horror films', 'film reviews'"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <Button type="submit" disabled={isPending || !query.trim()}>
            <Search className="h-4 w-4" />
            {isPending ? "Searching…" : "Search"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const active = platforms.has(p.id);
            const locked = p.id !== "youtube" && !modashEnabled;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                title={
                  locked
                    ? "Requires a Modash/HypeAuditor key (MODASH_API_KEY)"
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

      {data && data.results.length === 0 && !isPending && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No creators found. Try a broader niche.
        </p>
      )}

      <div className="space-y-3">
        {data?.results.map((r) => {
          const key = `${r.platform}:${r.channelId}`;
          const state = added[key];
          const PlatformIcon =
            r.platform === "instagram"
              ? Camera
              : r.platform === "tiktok"
                ? Music2
                : Video;
          return (
            <div
              key={key}
              className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                {r.thumbnail ? (
                  <Image
                    src={r.thumbnail}
                    alt={r.name}
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
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-medium hover:underline"
                  >
                    {r.name}
                  </a>
                  <PlatformIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {r.handle && (
                  <p className="truncate text-xs text-zinc-500">{r.handle}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {fmt(r.subscribers)} subs
                  </span>
                  {r.avgViews > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {fmt(r.avgViews)} avg views
                    </span>
                  )}
                  {r.engagementRate > 0 && (
                    <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                      <Heart className="h-3 w-3" /> {r.engagementRate}% engagement
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {state === "done" ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" /> Added
                  </span>
                ) : state === "dupe" ? (
                  <span className="text-xs text-zinc-400">Already saved</span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={state === "adding"}
                    onClick={() => handleAdd(r)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {state === "adding" ? "Adding…" : "Add"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
