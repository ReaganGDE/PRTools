"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateScreenerStatus } from "@/app/(app)/movies/[id]/press-actions";

type Row = {
  movieId: string;
  contactId: string;
  status: "requested" | "approved";
  movieTitle: string | null;
  contactName: string;
  contactOutlet: string | null;
  contactEmail: string | null;
  requestedAt: string | null;
};

function waitedFor(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function ScreenerQueue({ rows }: { rows: Row[] }) {
  // Locally hide rows once resolved so the queue feels responsive.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const visible = rows.filter((r) => !hidden.has(`${r.movieId}:${r.contactId}`));

  function act(
    row: Row,
    next: "approved" | "sent" | "declined",
  ) {
    const key = `${row.movieId}:${row.contactId}`;
    setPendingKey(key);
    startTransition(async () => {
      await updateScreenerStatus(row.movieId, row.contactId, next);
      // approving keeps it in the queue (status changes); sent/declined removes it
      if (next === "sent" || next === "declined") {
        setHidden((cur) => new Set(cur).add(key));
      }
      setPendingKey(null);
    });
  }

  if (visible.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        All caught up — every pending request has been handled.
      </p>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-900">
      {visible.map((r) => {
        const key = `${r.movieId}:${r.contactId}`;
        const busy = isPending && pendingKey === key;
        return (
          <div key={key} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                r.status === "requested"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              {r.status}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/contacts/${r.contactId}`} className="font-medium hover:underline">
                  {r.contactName}
                </Link>
                {r.contactOutlet && (
                  <span className="text-xs text-zinc-500">{r.contactOutlet}</span>
                )}
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <Link href={`/movies/${r.movieId}`} className="text-xs text-zinc-500 hover:underline">
                  {r.movieTitle ?? "Untitled film"}
                </Link>
              </div>
              <div className="text-xs text-zinc-400">
                {r.contactEmail ?? "no email on file"} · waiting {waitedFor(r.requestedAt)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {r.status === "requested" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => act(r, "approved")}
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => act(r, "sent")}
              >
                <Send className="h-3.5 w-3.5" /> Mark sent
              </Button>
              <button
                type="button"
                title="Decline"
                disabled={busy}
                onClick={() => act(r, "declined")}
                className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
