"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Search, UserPlus, Check, ExternalLink, Info,
  Newspaper, Mail, Database, Bookmark, Save, X, Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  searchPrContacts,
  addJournalistContact,
  logCoverageFromFinder,
  type PrFinderResult,
} from "./actions";
import { saveSearch, deleteSavedSearch } from "@/lib/saved-search-actions";

type SavedSearch = { id: string; name: string; query: string; platforms: string[] };
type MovieOption = { id: string; title: string };

export function PrFinder({
  newsEnabled,
  savedSearches: initialSavedSearches,
  movies,
}: {
  newsEnabled: boolean;
  savedSearches: SavedSearch[];
  movies: MovieOption[];
}) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PrFinderResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState<Record<string, "adding" | "done" | "dupe">>({});

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(initialSavedSearches);
  const [showSaveName, setShowSaveName] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isSaving, startSaveTransition] = useTransition();

  const [coverageOpen, setCoverageOpen] = useState<Record<string, boolean>>({});
  const [coverageLogged, setCoverageLogged] = useState<Record<string, boolean>>({});

  function handleDeleteSaved(id: string) {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    startSaveTransition(async () => { await deleteSavedSearch(id); });
  }

  function handleSaveSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!saveName.trim() || !query.trim()) return;
    const newSearch: SavedSearch = {
      id: `optimistic-${Date.now()}`,
      name: saveName.trim(),
      query: query.trim(),
      platforms: [],
    };
    setSavedSearches((prev) => [...prev, newSearch]);
    setShowSaveName(false);
    setSaveName("");
    startSaveTransition(async () => {
      await saveSearch("pr", newSearch.name, newSearch.query, []);
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const fd = new FormData();
    fd.set("query", query.trim());
    startTransition(async () => {
      const r = await searchPrContacts(fd);
      setData(r);
      setAdded({});
      setCoverageOpen({});
      setCoverageLogged({});
    });
  }

  function handleAdd(name: string, outlet: string | null) {
    setAdded((prev) => ({ ...prev, [name]: "adding" }));
    const fd = new FormData();
    fd.set("name", name);
    if (outlet) fd.set("outlet", outlet);
    if (query.trim()) fd.set("beat", query.trim());
    startTransition(async () => {
      const res = await addJournalistContact(fd);
      setAdded((prev) => ({ ...prev, [name]: res.added ? "done" : "dupe" }));
    });
  }

  function toggleCoverage(name: string) {
    setCoverageOpen((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function handleLogCoverage(
    e: React.FormEvent<HTMLFormElement>,
    journalistName: string,
  ) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await logCoverageFromFinder(fd);
      if (res.ok) {
        setCoverageLogged((prev) => ({ ...prev, [journalistName]: true }));
        setCoverageOpen((prev) => ({ ...prev, [journalistName]: false }));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Bookmark className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          {savedSearches.map((s) => (
            <span key={s.id} className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white pl-3 pr-1 py-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <button type="button" onClick={() => setQuery(s.query)} className="hover:text-red-600 dark:hover:text-red-400">
                {s.name}
              </button>
              <button type="button" onClick={() => handleDeleteSaved(s.id)} className="ml-0.5 rounded-full p-0.5 text-zinc-400 hover:text-red-500">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Topic or beat — e.g. 'indie horror', 'film festival', or a name/outlet"
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <Button type="submit" disabled={isPending || !query.trim()}>
          <Search className="h-4 w-4" />
          {isPending ? "Searching…" : "Search"}
        </Button>
        {query.trim() && (
          <button
            type="button"
            onClick={() => setShowSaveName((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <Save className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {showSaveName && (
        <form onSubmit={handleSaveSearch} className="flex gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <input
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Search name…"
            className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!saveName.trim() || isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowSaveName(false)}>Cancel</Button>
        </form>
      )}

      {data?.note && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{data.note}</span>
        </div>
      )}

      {data && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <Database className="h-3.5 w-3.5" /> In your contacts ({data.existing.length})
          </h3>
          {data.existing.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">No matching contacts yet.</p>
          ) : (
            <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-900">
              {data.existing.map((c) => (
                <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{c.name}</span>
                    {(c.outlet || c.beat) && (
                      <span className="ml-2 text-xs text-zinc-500">{[c.outlet, c.beat].filter(Boolean).join(" · ")}</span>
                    )}
                  </div>
                  {c.email && <span className="flex items-center gap-1 text-xs text-zinc-400"><Mail className="h-3 w-3" /> {c.email}</span>}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {data && newsEnabled && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <Newspaper className="h-3.5 w-3.5" /> Discovered journalists ({data.discovered.length})
          </h3>
          {data.discovered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">No journalists found for this topic.</p>
          ) : (
            <div className="space-y-2">
              {data.discovered.map((j) => {
                const state = added[j.name];
                const isDone = state === "done" || j.alreadyInDb;
                const isLogged = coverageLogged[j.name];
                const showPanel = coverageOpen[j.name];
                return (
                  <div key={j.name} className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
                    <div className="flex items-center gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{j.name}</span>
                          {j.outlet && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{j.outlet}</span>}
                          <span className="text-[10px] text-zinc-400">{j.articleCount} article{j.articleCount === 1 ? "" : "s"}</span>
                        </div>
                        {j.latestHeadline && (
                          <a href={j.latestUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500 hover:underline">
                            {j.latestHeadline}<ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {movies.length > 0 && j.latestHeadline && (
                          isLogged ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <Check className="h-3.5 w-3.5" /> Logged
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleCoverage(j.name)}
                              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                                showPanel
                                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                                  : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                              }`}
                            >
                              <Film className="h-3 w-3" />
                              Log coverage
                            </button>
                          )
                        )}
                        {isDone ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" />{j.alreadyInDb && state !== "done" ? "In DB" : "Added"}
                          </span>
                        ) : state === "dupe" ? (
                          <span className="text-xs text-zinc-400">Already saved</span>
                        ) : (
                          <Button type="button" size="sm" variant="outline" disabled={state === "adding"} onClick={() => handleAdd(j.name, j.outlet)}>
                            <UserPlus className="h-3.5 w-3.5" />{state === "adding" ? "Adding…" : "Add"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {showPanel && (
                      <form
                        onSubmit={(e) => handleLogCoverage(e, j.name)}
                        className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                      >
                        <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Log this article as film coverage</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[11px] text-zinc-500">Film</label>
                            <select
                              name="movieId"
                              required
                              className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                            >
                              <option value="">Select a film…</option>
                              {movies.map((m) => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] text-zinc-500">Sentiment</label>
                            <select
                              name="sentiment"
                              className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                            >
                              <option value="">— not set —</option>
                              <option value="positive">Positive</option>
                              <option value="neutral">Neutral</option>
                              <option value="negative">Negative</option>
                            </select>
                          </div>
                        </div>
                        <input type="hidden" name="headline" value={j.latestHeadline ?? ""} />
                        <input type="hidden" name="url" value={j.latestUrl ?? ""} />
                        <input type="hidden" name="outlet" value={j.outlet ?? ""} />
                        {j.publishedAt && <input type="hidden" name="publishedAt" value={j.publishedAt} />}
                        <div className="mt-2 flex items-center gap-2">
                          <Button type="submit" size="sm" disabled={isPending}>
                            Save coverage
                          </Button>
                          <button
                            type="button"
                            onClick={() => toggleCoverage(j.name)}
                            className="text-xs text-zinc-400 hover:text-zinc-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
