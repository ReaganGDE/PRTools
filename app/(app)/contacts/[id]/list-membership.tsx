"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addContactsToList, removeContactFromList, createList } from "../actions";
import { cn } from "@/lib/utils";

type ListOption = { id: string; name: string };

export function ListMembership({
  contactId,
  contactLists,
  allLists,
}: {
  contactId: string;
  contactLists: ListOption[];
  allLists: ListOption[];
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();

  const memberIds = new Set(contactLists.map((l) => l.id));
  const available = allLists.filter((l) => !memberIds.has(l.id));

  function add(listId: string) {
    setOpen(false);
    startTransition(async () => {
      await addContactsToList(listId, [contactId]);
    });
  }

  function remove(listId: string) {
    startTransition(async () => {
      await removeContactFromList(listId, contactId);
    });
  }

  function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createList(name);
      if (res.ok && "id" in res && res.id) {
        await addContactsToList(res.id, [contactId]);
        setNewName("");
        setCreating(false);
        setOpen(false);
      }
    });
  }

  return (
    <div className="space-y-2">
      {contactLists.length === 0 ? (
        <p className="text-sm text-zinc-500">Not in any list.</p>
      ) : (
        <ul className="space-y-1">
          {contactLists.map((l) => (
            <li
              key={l.id}
              className="group flex items-center justify-between rounded-md bg-zinc-50 px-2.5 py-1.5 text-sm dark:bg-zinc-800/40"
            >
              <Link
                href={`/contacts/lists/${l.id}`}
                className="truncate hover:underline"
              >
                {l.name}
              </Link>
              <button
                type="button"
                onClick={() => remove(l.id)}
                disabled={isPending}
                title="Remove from list"
                className="ml-2 rounded p-0.5 text-zinc-400 opacity-0 transition-all hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(!open)}
          disabled={isPending}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5" /> Add to list
        </Button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            {!creating ? (
              <>
                <ul className="max-h-56 overflow-y-auto py-1">
                  {available.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-zinc-500">
                      Already in every list
                    </li>
                  ) : (
                    available.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => add(l.id)}
                          className="w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          {l.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className={cn(
                    "flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-zinc-800 dark:hover:bg-red-950/20",
                  )}
                >
                  <Plus className="h-3.5 w-3.5" /> New list…
                </button>
              </>
            ) : (
              <div className="p-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createAndAdd();
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                  placeholder="List name"
                  autoFocus
                  className="h-8 w-full rounded border border-zinc-200 px-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-800"
                />
                <div className="mt-2 flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={createAndAdd}
                    disabled={!newName.trim() || isPending}
                    className="flex-1"
                  >
                    <Check className="h-3 w-3" /> Create
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
