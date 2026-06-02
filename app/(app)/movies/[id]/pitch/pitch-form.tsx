"use client";
import { useState, useTransition } from "react";
import { Send, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendFilmPitch, type PitchResult } from "./actions";

type Recipient = {
  id: string;
  name: string;
  email: string | null;
  outlet: string | null;
  beat: string | null;
  screenerSentAt: string | null;
};

const MERGE_HINTS = [
  "{{first_name}}",
  "{{film_title}}",
  "{{logline}}",
  "{{trailer_url}}",
  "{{screener_url}}",
  "{{screener_password}}",
  "{{release_date}}",
  "{{director}}",
];

export function PitchForm({
  movieId,
  recipients,
  defaultSubject,
  defaultBody,
}: {
  movieId: string;
  recipients: Recipient[];
  defaultSubject: string;
  defaultBody: string;
}) {
  const emailable = recipients.filter((r) => r.email);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(emailable.map((r) => r.id)),
  );
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [markScreener, setMarkScreener] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<PitchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("body", body);
    if (markScreener) fd.set("markScreener", "on");
    for (const id of selected) fd.append("contactIds", id);
    startTransition(async () => {
      try {
        const r = await sendFilmPitch(movieId, fd);
        setResult(r);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Recipients */}
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Recipients ({selected.size} selected)
        </h3>
        <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800/60 dark:bg-zinc-900">
          {recipients.map((r) => {
            const disabled = !r.email;
            return (
              <label
                key={r.id}
                className={
                  "flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm " +
                  (disabled ? "opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50")
                }
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="h-4 w-4"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.name}</span>
                  {(r.outlet || r.beat) && (
                    <span className="ml-2 text-xs text-zinc-500">
                      {[r.outlet, r.beat].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  <span className="block text-xs text-zinc-400">
                    {r.email ?? "no email on file"}
                  </span>
                </span>
                {r.screenerSentAt && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Screener sent
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      {/* Subject */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Subject
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Message
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
        <div className="flex items-start gap-1.5 text-xs text-zinc-400">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Merge fields:{" "}
            {MERGE_HINTS.map((h) => (
              <code
                key={h}
                className="mx-0.5 rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800"
              >
                {h}
              </code>
            ))}
          </span>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={markScreener}
          onChange={(e) => setMarkScreener(e.target.checked)}
          className="h-4 w-4"
        />
        Mark screener as sent to recipients after sending
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Sent {result.sent} pitch{result.sent === 1 ? "" : "es"}
            {result.skipped > 0 ? `, ${result.skipped} skipped` : ""}
            {result.failed > 0 ? `, ${result.failed} failed` : ""}.
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || selected.size === 0}>
          <Send className="h-4 w-4" />
          {isPending ? "Sending…" : `Send to ${selected.size}`}
        </Button>
      </div>
    </form>
  );
}
