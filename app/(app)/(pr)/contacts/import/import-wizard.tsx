"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importCsv, type ImportColumnMap } from "../actions";

const FIELDS: { key: keyof ImportColumnMap; label: string }[] = [
  { key: "name", label: "Name *" },
  { key: "email", label: "Email" },
  { key: "type", label: "Type (influencer/outlet/journalist)" },
  { key: "outlet", label: "Outlet" },
  { key: "beat", label: "Beat" },
  { key: "followerCount", label: "Follower count" },
  { key: "handleInstagram", label: "Instagram handle" },
  { key: "handleTiktok", label: "TikTok handle" },
  { key: "handleReddit", label: "Reddit handle" },
  { key: "handleYoutube", label: "YouTube handle" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Notes" },
];

type Stage = "upload" | "map" | "done";

export function ImportWizard() {
  const [stage, setStage] = useState<Stage>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<ImportColumnMap>({});
  const [tagsToApply, setTagsToApply] = useState("");
  const [defaultType, setDefaultType] = useState<
    "influencer" | "outlet" | "journalist"
  >("influencer");
  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function autoMap(hdrs: string[]) {
    const next: ImportColumnMap = {};
    for (const h of hdrs) {
      const lower = h.toLowerCase().trim();
      if (!next.name && /^(name|full ?name|contact)$/.test(lower)) next.name = h;
      else if (!next.email && /e?mail/.test(lower)) next.email = h;
      else if (!next.type && /type|category/.test(lower)) next.type = h;
      else if (!next.outlet && /outlet|publication|company|brand/.test(lower))
        next.outlet = h;
      else if (!next.beat && /beat|topic/.test(lower)) next.beat = h;
      else if (
        !next.followerCount &&
        /follower|audience|subs?(cribers)?/.test(lower)
      )
        next.followerCount = h;
      else if (!next.handleInstagram && /instagram|^ig$/.test(lower))
        next.handleInstagram = h;
      else if (!next.handleTiktok && /tiktok/.test(lower)) next.handleTiktok = h;
      else if (!next.handleReddit && /reddit/.test(lower))
        next.handleReddit = h;
      else if (!next.handleYoutube && /youtube|^yt$/.test(lower))
        next.handleYoutube = h;
      else if (!next.tags && /tags?/.test(lower)) next.tags = h;
      else if (!next.notes && /notes?|comments?/.test(lower)) next.notes = h;
    }
    setMap(next);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0) {
          setError(res.errors[0].message);
          return;
        }
        const hdrs = res.meta.fields ?? [];
        setHeaders(hdrs);
        setRows(res.data);
        autoMap(hdrs);
        setStage("map");
      },
      error: (err) => setError(err.message),
    });
  }

  function onImport() {
    if (!map.name) {
      setError("Map a column to 'Name' before importing.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const tags = tagsToApply
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await importCsv({ rows, map, defaultType, tagsToApply: tags });
      if ("ok" in res && res.ok) {
        setResult({
          inserted: res.inserted,
          updated: res.updated,
          skipped: res.skipped,
        });
        setStage("done");
      }
    });
  }

  if (stage === "upload") {
    return (
      <div className="max-w-xl space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="csv">CSV file</Label>
          <Input id="csv" type="file" accept=".csv,text/csv" onChange={onFile} />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <p className="text-xs text-zinc-500">
          First row must be headers. Any column order. We&apos;ll auto-detect
          common fields like Name, Email, Outlet, Instagram, etc.
        </p>
      </div>
    );
  }

  if (stage === "done" && result) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="rounded-md bg-green-50 p-4 text-sm dark:bg-green-950">
          Imported {result.inserted} new, updated {result.updated} existing,
          skipped {result.skipped}.
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/contacts">View contacts</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStage("upload");
              setRows([]);
              setHeaders([]);
              setMap({});
              setResult(null);
            }}
          >
            Import another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <strong>{rows.length}</strong> rows detected with{" "}
        <strong>{headers.length}</strong> columns.
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium">Map columns</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label>{f.label}</Label>
              <select
                value={map[f.key] ?? ""}
                onChange={(e) =>
                  setMap((m) => ({
                    ...m,
                    [f.key]: e.target.value || undefined,
                  }))
                }
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">— ignore —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Default type (if no &quot;type&quot; column)</Label>
          <select
            value={defaultType}
            onChange={(e) =>
              setDefaultType(
                e.target.value as "influencer" | "outlet" | "journalist",
              )
            }
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="influencer">Influencer</option>
            <option value="outlet">Outlet</option>
            <option value="journalist">Journalist</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>Apply these tags to all rows (comma-separated)</Label>
          <Input
            value={tagsToApply}
            onChange={(e) => setTagsToApply(e.target.value)}
            placeholder="film-launch-may, tier-1"
          />
        </div>
      </div>

      {rows.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium">Preview (first 5 rows)</h3>
          <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-2 py-1 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100 dark:border-zinc-900">
                    {headers.map((h) => (
                      <td key={h} className="truncate px-2 py-1 max-w-[200px]">
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <Button onClick={onImport} disabled={pending}>
          {pending ? "Importing…" : `Import ${rows.length} contacts`}
        </Button>
        <Button variant="outline" onClick={() => setStage("upload")}>
          Back
        </Button>
      </div>
    </div>
  );
}
