import { cookies } from "next/headers";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { brands } from "@/lib/db/schema";

const COOKIE = "active_brand";

export async function getActiveBrandId(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  if (!v || v === "all") return null;
  return v;
}

export async function getBrandsForWorkspace(workspaceId: string) {
  return db
    .select()
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId), eq(brands.active, true)))
    .orderBy(asc(brands.createdAt));
}

const DEFAULTS: { name: string; type: "company" | "streaming" | "label"; color: string }[] = [
  { name: "Good Deed Entertainment", type: "company", color: "#dc2626" },
  { name: "Cranked Up Films", type: "label", color: "#7c3aed" },
  { name: "Streaming Service", type: "streaming", color: "#0ea5e9" },
];

// Idempotent: ensures the workspace has the default brand set.
// Safe to call on every dashboard load — only seeds when zero brands exist.
export async function ensureDefaultBrands(workspaceId: string): Promise<void> {
  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.workspaceId, workspaceId))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(brands).values(
    DEFAULTS.map((d) => ({
      workspaceId,
      name: d.name,
      type: d.type,
      color: d.color,
    })),
  );
}
