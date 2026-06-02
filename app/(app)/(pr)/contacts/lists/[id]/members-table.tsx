"use client";
import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { X, Plus, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addContactsToList, removeContactFromList } from "../../actions";

type Member = {
  id: string;
  name: string;
  type: string;
  email: string | null;
  outlet: string | null;
  followerCount: number | null;
  addedAt: Date;
};

type Candidate = {
  id: string;
  name: string;
  type: string;
  email: string | null;
  outlet: string | null;
};

export function ListMembersTable({
  listId,
  listName,
  members,
  candidates,
}: {
  listId: string;
  listName: string;
  members: Member[];
  candidates: Candidate[];
}) {
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.outlet?.toLowerCase().includes(q),
    );
  }, [candidates, search]);

  function togglePick(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPicked() {
    const ids = Array.from(picked);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await addContactsToList(listId, ids);
      setFeedback(
        `Added ${res.added} contact${res.added === 1 ? "" : "s"} to ${listName}`,
      );
      setPicked(new Set());
      setPicking(false);
      setSearch("");
      setTimeout(() => setFeedback(null), 4000);
    });
  }

  function remove(contactId: string) {
    startTransition(async () => {
      await removeContactFromList(listId, contactId);
    });
  }

  return (
    <div className="space-y-3">
      {/* Header: count + add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Members{" "}
          <span className="ml-1 text-xs font-normal text-zinc-500">
            ({members.length})
          </span>
        </h2>
        {!picking && (
          <Button type="button" size="sm" onClick={() => setPicking(true)}>
            <Plus className="h-3.5 w-3.5" /> Add contacts
          </Button>
        )}
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check className="h-4 w-4" /> {feedback}
        </div>
      )}

      {/* Picker */}
      {picking && (
        <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-100 p-3 dark:border-zinc-800/60">
            <Search className="h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search contacts to add…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="border-0 shadow-none focus-visible:ring-0"
            />
            <span className="shrink-0 text-xs text-zinc-500">
              {picked.size} selected
            </span>
            <Button
              type="button"
              size="sm"
              onClick={addPicked}
              disabled={picked.size === 0 || isPending}
            >
              {isPending ? "Adding…" : `Add ${picked.size || ""}`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPicking(false);
                setPicked(new Set());
                setSearch("");
              }}
            >
              Cancel
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">
                {candidates.length === 0
                  ? "Every contact in your workspace is already in this list."
                  : "No matches."}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filtered.map((c) => {
                  const checked = picked.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => togglePick(c.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                          checked
                            ? "bg-red-50/60 dark:bg-red-950/20"
                            : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePick(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer rounded accent-red-600"
                        />
                        <span className="flex-1">
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-xs text-zinc-500 capitalize">
                            {c.type}
                          </span>
                        </span>
                        <span className="text-xs text-zinc-500">
                          {c.email ?? c.outlet ?? ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Members list */}
      {members.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/50 text-left dark:border-zinc-800 dark:bg-zinc-900/40">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Name</th>
                <th className="px-4 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Type</th>
                <th className="px-4 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Email</th>
                <th className="px-4 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Outlet</th>
                <th className="px-4 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Followers</th>
                <th className="px-4 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Added</th>
                <th className="w-8 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800/40 dark:hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/contacts/${m.id}`}
                      className="font-medium hover:underline"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 capitalize text-zinc-500">{m.type}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{m.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{m.outlet ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-zinc-500">
                    {m.followerCount?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-400">
                    {m.addedAt.toLocaleDateString()}
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      disabled={isPending}
                      title="Remove from list"
                      className="rounded p-1.5 text-zinc-400 opacity-0 transition-all hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
