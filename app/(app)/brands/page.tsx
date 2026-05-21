import { Plus } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { getBrandsForWorkspace } from "@/lib/brand-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrand, updateBrand } from "./actions";

export default async function BrandsPage() {
  const session = await requireSession();
  const brands = await getBrandsForWorkspace(session.workspaceId);

  return (
    <>
      <PageHeader
        title="Brands"
        description="Companies, labels, and streaming services. Posts and movies can be scoped to a brand."
      />
      <div className="space-y-6 p-8">
        {/* Existing brands */}
        <div className="space-y-3">
          {brands.map((b) => (
            <form
              key={b.id}
              action={updateBrand.bind(null, b.id)}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span
                className="h-10 w-10 shrink-0 rounded-md"
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
                  className="h-10 w-16 cursor-pointer rounded-md border border-zinc-200 dark:border-zinc-800"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={b.active}
                  className="accent-red-600"
                />
                Active
              </label>
              <Button type="submit" variant="outline" size="sm">
                Save
              </Button>
            </form>
          ))}
        </div>

        {/* Create new */}
        <form
          action={createBrand}
          className="grid gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-5 dark:border-zinc-700 dark:bg-zinc-900/20"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
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
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
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
                className="h-9 w-16 cursor-pointer rounded-md border border-zinc-200 dark:border-zinc-800"
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
