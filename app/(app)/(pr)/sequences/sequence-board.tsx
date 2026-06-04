"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendSequenceStep } from "./actions";
import { SEQUENCE_STEPS } from "@/lib/sequences";

export type SequenceRow = {
  movieId: string;
  contactId: string;
  movieTitle: string | null;
  contactName: string;
  contactOutlet: string | null;
  contactEmail: string | null;
  sentCount: number;
  nextStepIndex: number;
  nextStepLabel: string;
  due: boolean;
  dueAt: string | null;
};

function dueLabel(due: boolean, dueAt: string | null): string {
  if (due) return "due now";
  if (!dueAt) return "";
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "due now";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

export function SequenceBoard({ rows }: { rows: SequenceRow[] }) {
  const [done, setDone] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  function send(row: SequenceRow) {
    const key = `${row.movieId}:${row.contactId}`;
    setPendingKey(key);
    setErrors((e) => ({ ...e, [key]: "" }));
    startTransition(async () => {
      const res = await sendSequenceStep(row.movieId, row.contactId, row.nextStepIndex);
      if (res.sent) {
        setDone((d) => ({ ...d, [key]: row.nextStepLabel }));
      } else {
        setErrors((e) => ({ ...e, [key]: res.error ?? "Failed to send" }));
      }
      setPendingKey(null);
    });
  }

  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-900">
      {rows.map((r) => {
        const key = `${r.movieId}:${r.contactId}`;
        const sentLabel = done[key];
        const busy = isPending && pendingKey === key;
        const noEmail = !r.contactEmail;

        return (
          <div key={key} className="flex flex-wrap items-center gap-3 px-4 py-3">
            {/* Step pips */}
            <div className="flex shrink-0 items-center gap-1" title={`Step ${r.nextStepIndex + 1} of ${SEQUENCE_STEPS.length}`}>
              {SEQUENCE_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < r.sentCount
                      ? "bg-emerald-500"
                      : i === r.nextStepIndex
                        ? r.due
                          ? "bg-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-900"
                          : "bg-amber-400"
                        : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              ))}
            </div>

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
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="font-medium text-zinc-500">
                  Next: {r.nextStepLabel}
                </span>
                <span className={r.due ? "text-emerald-600 dark:text-emerald-400" : ""}>
                  · {dueLabel(r.due, r.dueAt)}
                </span>
                {errors[key] && (
                  <span className="text-red-500">· {errors[key]}</span>
                )}
              </div>
            </div>

            <div className="shrink-0">
              {sentLabel ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Send className="h-3 w-3" /> {sentLabel} sent
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant={r.due ? "default" : "outline"}
                  disabled={busy || noEmail}
                  onClick={() => send(r)}
                  title={noEmail ? "No email address on file" : undefined}
                >
                  {r.due ? <Send className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {busy ? "Sending…" : r.due ? `Send ${r.nextStepLabel.toLowerCase()}` : "Send early"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
