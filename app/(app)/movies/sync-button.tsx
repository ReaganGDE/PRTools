"use client";
import { useState, useTransition } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncMoviesFromAirtable, type SyncResult } from "./actions";

export function SyncFromAirtableButton() {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSync() {
    setError(null);
    setResults(null);
    startTransition(async () => {
      try {
        const data = await syncMoviesFromAirtable();
        setResults(data.results);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleSync}
        disabled={isPending}
      >
        <RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {isPending ? "Syncing…" : "Sync from Airtable"}
      </Button>
      {error && (
        <div className="flex max-w-md items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {results && results.length > 0 && (
        <div className="flex max-w-md flex-col gap-1 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Sync complete
          </div>
          {results.map((r) => (
            <div key={r.brand} className="pl-5 text-emerald-700 dark:text-emerald-400">
              <strong>{r.brand}:</strong>{" "}
              {r.error ? (
                <span className="text-red-700 dark:text-red-400">{r.error}</span>
              ) : (
                <>
                  {r.inserted} added, {r.updated} updated
                  {r.skipped > 0 ? `, ${r.skipped} skipped` : ""}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
