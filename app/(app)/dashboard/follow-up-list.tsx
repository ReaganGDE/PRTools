"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock, ChevronRight, Send, Check, AlertCircle } from "lucide-react";
import { sendFollowUpReminder } from "./follow-up-actions";

type FollowUp = {
  movieId: string;
  title: string;
  contactId: string;
  contactName: string;
  outlet: string | null;
  email: string | null;
  screenerSentAt: string;
};

type SendState = "idle" | "sending" | "sent" | "error";

export function FollowUpList({ items }: { items: FollowUp[] }) {
  const now = Date.now();
  const [states, setStates] = useState<Record<string, SendState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  function handleSend(f: FollowUp) {
    const key = `${f.movieId}-${f.contactId}`;
    setStates((s) => ({ ...s, [key]: "sending" }));
    startTransition(async () => {
      const res = await sendFollowUpReminder(f.movieId, f.contactId);
      if (res.sent) {
        setStates((s) => ({ ...s, [key]: "sent" }));
      } else {
        setStates((s) => ({ ...s, [key]: "error" }));
        setErrors((e) => ({ ...e, [key]: res.error ?? "Failed to send" }));
      }
    });
  }

  return (
    <ul className="space-y-2">
      {items.map((f) => {
        const key = `${f.movieId}-${f.contactId}`;
        const state = states[key] ?? "idle";
        const sentAt = new Date(f.screenerSentAt);
        const days = Math.floor((now - sentAt.getTime()) / (24 * 60 * 60 * 1000));
        return (
          <li
            key={key}
            className={`group flex items-center gap-3 rounded-xl border p-3 text-sm transition-all ${
              state === "sent"
                ? "border-emerald-200/70 bg-emerald-50/50 opacity-70 dark:border-emerald-900/30 dark:bg-emerald-950/20"
                : "border-blue-200/70 bg-blue-50/50 hover:shadow-sm dark:border-blue-900/30 dark:bg-blue-950/20"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                state === "sent"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
              }`}
            >
              {state === "sent" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
            </span>

            <Link href={`/movies/${f.movieId}/pitch`} className="min-w-0 flex-1">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {f.contactName}
              </span>
              {f.outlet && (
                <span className="ml-2 text-xs text-zinc-500">{f.outlet}</span>
              )}
              <span className="block truncate text-xs text-zinc-500">
                {f.title}
              </span>
            </Link>

            {state === "sent" ? (
              <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Reminder sent
              </span>
            ) : state === "error" ? (
              <span
                className="flex shrink-0 items-center gap-1 text-xs font-medium text-red-600"
                title={errors[key]}
              >
                <AlertCircle className="h-3.5 w-3.5" /> {errors[key]}
              </span>
            ) : (
              <>
                <span className="shrink-0 text-xs font-medium text-blue-700 dark:text-blue-400">
                  no reply · {days}d ago
                </span>
                <button
                  type="button"
                  onClick={() => handleSend(f)}
                  disabled={state === "sending" || !f.email}
                  title={!f.email ? "No email on file" : "Send a follow-up reminder"}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
                >
                  <Send className="h-3 w-3" />
                  {state === "sending" ? "Sending…" : "Send reminder"}
                </button>
              </>
            )}
            <ChevronRight className="hidden h-4 w-4 shrink-0 text-blue-400 sm:block" />
          </li>
        );
      })}
    </ul>
  );
}
