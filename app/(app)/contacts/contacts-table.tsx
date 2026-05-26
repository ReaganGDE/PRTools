"use client";
import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addContactsToList, createList } from "./actions";

type ContactRow = {
  id: string;
  name: string;
  type: string;
  email: string | null;
  outlet: string | null;
  handleInstagram: string | null;
  handleTiktok: string | null;
  handleReddit: string | null;
  handleYoutube: string | null;
  followerCount: number | null;
  tags: string[];
};

type ListOption = { id: string; name: string; memberCount: number };

export function ContactsTable({
  rows,
  lists,
  totalShown,
  pageSize,
}: {
  rows: ContactRow[];
  lists: ListOption[];
  totalShown: number;
  pageSize: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addToExistingList(listId: string, listName: string) {
    setPickerOpen(false);
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await addContactsToList(listId, ids);
      setFeedback(
        res.added > 0
          ? `Added ${res.added} contact${res.added === 1 ? "" : "s"} to "${listName}"${res.skipped > 0 ? ` (${res.skipped} already in list)` : ""}`
          : `All ${ids.length} contacts were already in "${listName}"`,
      );
      setSelected(new Set());
      setTimeout(() => setFeedback(null), 4000);
    });
  }

  function addToNewList() {
    const name = newListName.trim();
    if (!name) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      const created = await createList(name);
      if (created.ok && "id" in created && created.id) {
        const res = await addContactsToList(created.id, ids);
        setFeedback(
          `Created "${name}" with ${res.added} contact${res.added === 1 ? "" : "s"}`,
        );
        setSelected(new Set());
        setCreatingList(false);
        setNewListName("");
        setPickerOpen(false);
        setTimeout(() => setFeedback(null), 4000);
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/60 px-4 py-2.5 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="text-sm font-medium text-red-900 dark:text-red-200">
            {selected.size} contact{selected.size === 1 ? "" : "s"} selected
          </div>
          <div className="flex items-center gap-2">
            <ListPicker
              open={pickerOpen}
              setOpen={setPickerOpen}
              lists={lists}
              creatingList={creatingList}
              setCreatingList={setCreatingList}
              newListName={newListName}
              setNewListName={setNewListName}
              onPick={addToExistingList}
              onCreate={addToNewList}
              isPending={isPending}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check className="h-4 w-4" /> {feedback}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/50 text-left dark:border-zinc-800 dark:bg-zinc-900/40">
            <tr>
              <th className="w-8 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer rounded accent-red-600"
                />
              </th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Name</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Type</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Email</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Outlet</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Handles</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Followers</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">Tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const isChecked = selected.has(c.id);
              return (
                <tr
                  key={c.id}
                  className={cn(
                    "border-b border-zinc-100 transition-colors last:border-0 dark:border-zinc-800/40",
                    isChecked
                      ? "bg-red-50/40 dark:bg-red-950/10"
                      : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30",
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 cursor-pointer rounded accent-red-600"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500 capitalize">{c.type}</td>
                  <td className="px-3 py-2.5 text-zinc-500">{c.email ?? "—"}</td>
                  <td className="px-3 py-2.5 text-zinc-500">{c.outlet ?? "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-zinc-500">
                    {[
                      c.handleInstagram && `IG:${c.handleInstagram}`,
                      c.handleTiktok && `TT:${c.handleTiktok}`,
                      c.handleReddit && `R:${c.handleReddit}`,
                      c.handleYoutube && `YT:${c.handleYoutube}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-zinc-500">
                    {c.followerCount?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {c.tags.length === 0 ? (
                      "—"
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {t}
                          </span>
                        ))}
                        {c.tags.length > 3 && (
                          <span className="text-zinc-400">+{c.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800/60">
          Showing {totalShown} of {pageSize} max per page.
        </div>
      </div>
    </div>
  );
}

function ListPicker({
  open,
  setOpen,
  lists,
  creatingList,
  setCreatingList,
  newListName,
  setNewListName,
  onPick,
  onCreate,
  isPending,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  lists: ListOption[];
  creatingList: boolean;
  setCreatingList: (v: boolean) => void;
  newListName: string;
  setNewListName: (v: string) => void;
  onPick: (id: string, name: string) => void;
  onCreate: () => void;
  isPending: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      lists.filter((l) =>
        l.name.toLowerCase().includes(search.toLowerCase().trim()),
      ),
    [lists, search],
  );

  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(!open)}
        disabled={isPending}
      >
        Add to list <ChevronDown className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {!creatingList ? (
            <>
              <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
                <Input
                  type="search"
                  placeholder="Search lists…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <ul className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-zinc-500">
                    {lists.length === 0 ? "No lists yet" : "No matches"}
                  </li>
                ) : (
                  filtered.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => onPick(l.id, l.name)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <span className="truncate">{l.name}</span>
                        <span className="ml-2 text-xs text-zinc-400">
                          {l.memberCount}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <button
                type="button"
                onClick={() => setCreatingList(true)}
                className="flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-zinc-800 dark:hover:bg-red-950/20"
              >
                <Plus className="h-3.5 w-3.5" /> Create new list…
              </button>
            </>
          ) : (
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">New list</span>
                <button
                  type="button"
                  onClick={() => setCreatingList(false)}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                placeholder="List name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCreate();
                }}
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full"
                onClick={onCreate}
                disabled={isPending || !newListName.trim()}
              >
                Create & add selected
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
