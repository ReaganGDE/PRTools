"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  UserPlus,
  Check,
  ExternalLink,
  Info,
  Newspaper,
  Mail,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  searchPrContacts,
  addJournalistContact,
  type PrFinderResult,
} from "./actions";

export function PrFinder({ newsEnabled }: { newsEnabled: boolean }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PrFinderResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState<Record<string, "adding" | "done" | "dupe">>({});

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const fd = new FormData();
    fd.set("query", query.trim());
    startTransition(async () => {
      const r = await searchPrContacts(fd);
      setData(r);
      setAdded({});
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

  return (
    <div className="space-y-6">
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
      </form>

      {data?.note && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{data.note}</span>
        </div>
      )}

      {/* Existing contacts */}
      {data && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <Database className="h-3.5 w-3.5" /> In your contacts ({data.existing.length})
          </h3>
          {data.existing.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
              No matching contacts yet.
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-900">
              {data.existing.map((c) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{c.name}</span>
                    {(c.outlet || c.beat) && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {[c.outlet, c.beat].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                  {c.email && (
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Mail className="h-3 w-3" /> {c.email}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Discovered journalists */}
      {data && newsEnabled && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <Newspaper className="h-3.5 w-3.5" /> Discovered journalists ({data.discovered.length})
          </h3>
          {data.discovered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
              No journalists found for this topic.
            </p>
          ) : (
            <div className="space-y-2">
              {data.discovered.map((j) => {
                const state = added[j.name];
                const isDone = state === "done" || j.alreadyInDb;
                return (
                  <div
                    key={j.name}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{j.name}</span>
                        {j.outlet && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {j.outlet}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-400">
                          {j.articleCount} article{j.articleCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      {j.latestHeadline && (
                        <a
                          href={j.latestUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500 hover:underline"
                        >
                          {j.latestHeadline}
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                      )}
                    </div>
                    <div className="shrink-0">
                      {isDone ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          {j.alreadyInDb && state !== "done" ? "In DB" : "Added"}
                        </span>
                      ) : state === "dupe" ? (
                        <span className="text-xs text-zinc-400">Already saved</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={state === "adding"}
                          onClick={() => handleAdd(j.name, j.outlet)}
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
          )}
        </section>
      )}
    </div>
  );
}
