"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendInfluencerPitch } from "./actions";

type MovieOption = { id: string; title: string; screenerUrl: string | null; trailerUrl: string | null };
type TemplateOption = { id: string; name: string; subject: string; body: string };

const MERGE_HINT = "Available: {{name}}, {{first_name}}, {{film_title}}, {{screener_url}}, {{trailer_url}}, {{press_kit_url}}";

export function InfluencerPitchForm({
  contactId,
  contactName,
  contactEmail,
  contactPlatform,
  movies,
  templates,
}: {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPlatform: string | null;
  movies: MovieOption[];
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [movieId, setMovieId] = useState(movies[0]?.id ?? "");
  const [channel, setChannel] = useState<"email" | "dm">(contactEmail ? "email" : "dm");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ sent: boolean; error?: string } | null>(null);

  function loadTemplate(t: TemplateOption) {
    setSubject(t.subject);
    setBody(t.body);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("movieId", movieId);
    fd.set("channel", channel);
    fd.set("subject", subject);
    fd.set("body", body);
    setResult(null);
    startTransition(async () => {
      const res = await sendInfluencerPitch(contactId, fd);
      setResult(res);
      if (res.sent) {
        setTimeout(() => router.push(`/contacts/${contactId}`), 1500);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Film selector */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Film to pitch</label>
        {movies.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">
            No films in your workspace yet.{" "}
            <a href="/movies/new" className="underline">Add one</a> first.
          </p>
        ) : (
          <select
            value={movieId}
            onChange={(e) => setMovieId(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">— no film —</option>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Template loader */}
      {templates.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">Load template</label>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => loadTemplate(t)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Channel */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Send via</label>
        <div className="flex gap-2">
          {(["email", "dm"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setChannel(ch)}
              disabled={ch === "email" && !contactEmail}
              title={ch === "email" && !contactEmail ? `No email on file for ${contactName}` : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                channel === ch
                  ? "border-red-500 bg-red-50 text-red-700 dark:border-red-500/60 dark:bg-red-950/30 dark:text-red-300"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {ch === "email" ? "Email" : contactPlatform ? `DM (${contactPlatform})` : "DM / manual"}
            </button>
          ))}
        </div>
        {channel === "email" && contactEmail && (
          <p className="mt-1 text-xs text-zinc-400">→ {contactEmail}</p>
        )}
        {channel === "dm" && (
          <p className="mt-1 text-xs text-zinc-400">
            Compose your message below, then send it manually via the platform. We'll record it as sent.
          </p>
        )}
      </div>

      {/* Subject (email only) */}
      {channel === "email" && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Collaboration opportunity — {{film_title}}"
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
      )}

      {/* Body */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          required
          placeholder={`Hi {{first_name}},\n\nI wanted to reach out about…`}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-relaxed dark:border-zinc-800 dark:bg-zinc-950"
        />
        <p className="mt-1 text-[11px] text-zinc-400">{MERGE_HINT}</p>
      </div>

      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            result.sent
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          }`}
        >
          {result.sent ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {result.sent
              ? `Pitch sent! Redirecting to contact…`
              : result.error ?? "Something went wrong."}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || !body.trim()}>
          <Send className="h-4 w-4" />
          {isPending
            ? "Sending…"
            : channel === "email"
              ? "Send email"
              : "Record as sent"}
        </Button>
        <a href={`/contacts/${contactId}`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Cancel
        </a>
      </div>
    </form>
  );
}
