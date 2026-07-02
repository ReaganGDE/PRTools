import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaceSettings } from "@/lib/db/schema";

export async function getSettings(workspaceId: string) {
  const [row] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId));
  if (row) return row;
  // Lazy-create defaults on first access.
  const [created] = await db
    .insert(workspaceSettings)
    .values({ workspaceId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Race fallback
  const [again] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId));
  return again;
}
