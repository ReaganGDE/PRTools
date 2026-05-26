import Link from "next/link";
import { eq } from "drizzle-orm";
import { Plus, Database } from "lucide-react";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { getBrandsForWorkspace } from "@/lib/brand-context";
import { listTables } from "@/lib/integrations/airtable";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrand, updateBrand } from "./actions";

export default async function BrandsPage() {
  const session = await requireSession();
  const [brandList, [ws]] = await Promise.all([
    getBrandsForWorkspace(session.workspaceId),
    db
      .select({
        token: workspaces.airtableToken,
        baseId: workspaces.airtableBaseId,
      })
      .from(workspaces)
      .where(eq(workspaces.id, session.workspaceId)),
  ]);

  let airtableTables: { id: string; name: string }[] = [];
  if (ws?.token && ws?.baseId) {
    try {
      const tables = await listTables(ws.token, ws.baseId);
      airtableTables = tables.map((t) => ({ id: t.id, name: t.name }));
    } catch {
      // Silently ignore — the integrations page will surface the error.
    }
  }

  const hasAirtable = airtableTables.length > 0;

  return (
    <>
      <PageHeader
        title="Brands"
        description="Companies, labels, and streaming services. Posts and movies can be scoped to a brand."
      />
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        {!hasAirtable && ws?.token && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Airtable connected, but no tables loaded.
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              Check your token scopes and base ID at{" "}
              <Link href="/settings/integrations" className="underline">
                /settings/integrations
              </Link>
              .
            </p>
          </div>
        )}

        {!ws?.token && (
          <div className="rounded-xl border border-zinc-200/80 bg-white p-4 text-sm dark:border-zinc-800/60 dark:bg-zinc-900">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800">
                <Database className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Sync brands from Airtable</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Connect your Airtable workspace to pull movies and metadata
                  into PRTools automatically.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/integrations">Connect</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Existing brands */}
        <div className="space-y-3">
          {brandList.map((b) => (
            <form
              key={b.id}
              action={updateBrand.bind(null, b.id)}
              className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
              style={{ borderLeftWidth: 3, borderLeftColor: b.color }}
            >
              <div className="flex flex-wrap items-end gap-3">
                <span
                  className="h-10 w-10 shrink-0 rounded-lg shadow-sm"
                  style={{ backgroundColor: b.color }}
                />
                <div className="grid flex-1 gap-1.5 min-w-[200px]">
                  <Label htmlFor={`name-${b.id}`}>Name</Label>
                  <Input id={`name-${b.id}`} name="name" defaultValue={b.name} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`color-${b.id}`}>Color</Label>
                  <input
                    id={`color-${b.id}`}
                    name="color"
                    type="color"
                    defaultValue={b.color}
                    className="h-9 w-16 cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700"
                  />
                </div>
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={b.active}
                    className="accent-red-600"
                  />
                  Active
                </label>
              </div>

              {hasAirtable && (
                <div className="mt-4 grid gap-1.5 border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
                  <Label htmlFor={`at-${b.id}`} className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-zinc-400" />
                    Airtable table
                  </Label>
                  <select
                    id={`at-${b.id}`}
                    name="airtableTableId"
                    defaultValue={b.airtableTableId ?? ""}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">— Don&apos;t sync from Airtable —</option>
                    {airtableTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {b.airtableLastSyncedAt && (
                    <p className="text-[11px] text-zinc-500">
                      Last synced {b.airtableLastSyncedAt.toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button type="submit" variant="outline" size="sm">
                  Save changes
                </Button>
              </div>
            </form>
          ))}
        </div>

        {/* Create new */}
        <form
          action={createBrand}
          className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Add a brand
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <div className="grid gap-1.5">
              <Label htmlFor="new-name">Name</Label>
              <Input id="new-name" name="name" required placeholder="e.g. Good Deed Entertainment" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-type">Type</Label>
              <select
                id="new-type"
                name="type"
                defaultValue="company"
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="company">Company</option>
                <option value="label">Label</option>
                <option value="streaming">Streaming</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-color">Color</Label>
              <input
                id="new-color"
                name="color"
                type="color"
                defaultValue="#dc2626"
                className="h-9 w-16 cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
            </div>
            <Button type="submit" className="self-end">
              Add brand
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
