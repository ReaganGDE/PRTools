"use client";
import { useState, useTransition } from "react";
import { Link2, RefreshCw, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateReportToken, revokeReportToken } from "./actions";

export function ShareControls({
  movieId,
  initialToken,
}: {
  movieId: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${token}`
      : token
        ? `/r/${token}`
        : null;

  function handleGenerate() {
    startTransition(async () => {
      const t = await generateReportToken(movieId);
      setToken(t);
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      await revokeReportToken(movieId);
      setToken(null);
    });
  }

  function handleCopy() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!token) {
    return (
      <Button type="button" onClick={handleGenerate} disabled={isPending} variant="outline">
        <Link2 className="h-4 w-4" />
        {isPending ? "Generating…" : "Generate share link"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900">
        <Link2 className="h-3 w-3 shrink-0 text-zinc-400" />
        <span className="truncate font-mono text-zinc-600 dark:text-zinc-400">
          {publicUrl}
        </span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900"
        title="Copy link"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        title="Regenerate link (invalidates old link)"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
      </button>
      <button
        type="button"
        onClick={handleRevoke}
        disabled={isPending}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-red-400 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        title="Revoke link"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
