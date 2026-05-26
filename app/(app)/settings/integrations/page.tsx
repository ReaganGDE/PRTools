import { eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { listTables } from "@/lib/integrations/airtable";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAirtableConfig, clearAirtableConfig } from "./actions";

export default async function IntegrationsPage() {
  const session = await requireSession();
  const [ws] = await db
    .select({
      token: workspaces.airtableToken,
      baseId: workspaces.airtableBaseId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, session.workspaceId));

  const connected = !!ws?.token && !!ws?.baseId;

  // If connected, try to fetch table names for display
  let tableNames: { id: string; name: string }[] = [];
  let connectionError: string | null = null;
  if (connected) {
    try {
      const tables = await listTables(ws.token!, ws.baseId!);
      tableNames = tables.map((t) => ({ id: t.id, name: t.name }));
    } catch (e) {
      connectionError = (e as Error).message;
    }
  }

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect external tools to PRTools."
      />
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-5 dark:border-zinc-800/60">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <AirtableLogo />
              </div>
              <div>
                <h2 className="text-base font-semibold">Airtable</h2>
                <p className="text-xs text-zinc-500">
                  Sync your slate from Airtable into the Movies catalog. Read-only.
                </p>
              </div>
            </div>
            <span
              className={
                connected
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }
            >
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>

          {connectionError && (
            <div className="border-b border-red-100 bg-red-50/50 px-5 py-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
              Couldn&apos;t reach Airtable: {connectionError}
            </div>
          )}

          <form action={saveAirtableConfig} className="space-y-4 p-5">
            <div className="grid gap-1.5">
              <Label htmlFor="token">Personal Access Token</Label>
              <Input
                id="token"
                name="token"
                type="password"
                placeholder={connected ? "••••••••  (leave blank to keep current)" : "pat..."}
                autoComplete="off"
              />
              <p className="text-[11px] text-zinc-500">
                Create one at{" "}
                <a
                  href="https://airtable.com/create/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-red-600 hover:underline dark:text-red-400"
                >
                  airtable.com/create/tokens <ExternalLink className="h-3 w-3" />
                </a>{" "}
                with <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">data.records:read</code> +{" "}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">schema.bases:read</code> scopes on
                the relevant bases.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="baseId">Base ID</Label>
              <Input
                id="baseId"
                name="baseId"
                placeholder="appXXXXXXXXXXXXXX"
                defaultValue={ws?.baseId ?? ""}
              />
              <p className="text-[11px] text-zinc-500">
                Open your base in Airtable; the base ID is in the URL after{" "}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/app</code>.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit">Save</Button>
              {connected && (
                <Button
                  type="button"
                  variant="outline"
                  formAction={clearAirtableConfig}
                >
                  Disconnect
                </Button>
              )}
            </div>
          </form>

          {connected && tableNames.length > 0 && (
            <div className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-4 dark:border-zinc-800/60 dark:bg-zinc-900/40">
              <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Tables in this base ({tableNames.length}):
              </p>
              <div className="space-y-1.5">
                {tableNames.slice(0, 8).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <code className="rounded bg-zinc-200/50 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {t.id}
                    </code>
                    <span className="text-zinc-600 dark:text-zinc-400">{t.name}</span>
                  </div>
                ))}
                {tableNames.length > 8 && (
                  <p className="text-[11px] italic text-zinc-500">
                    +{tableNames.length - 8} more…
                  </p>
                )}
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">
                Map each brand to a table on the{" "}
                <a href="/brands" className="text-red-600 hover:underline dark:text-red-400">
                  Brands page
                </a>
                , then click <strong>Sync</strong> on <a href="/movies" className="text-red-600 hover:underline dark:text-red-400">/movies</a>.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AirtableLogo() {
  return (
    <svg viewBox="0 0 200 170" className="h-5 w-5" fill="currentColor">
      <path d="M100 0L0 40v90l100 40 100-40V40z" opacity="0.2" />
      <path d="M0 40l100 40 100-40-100-40z" />
    </svg>
  );
}
