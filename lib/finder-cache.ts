import { eq, and, gt, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { finderCache } from "@/lib/db/schema";

const TTL_MS = 24 * 60 * 60 * 1000;

export async function getCached<T>(workspaceId: string, key: string): Promise<T | null> {
  const [row] = await db
    .select({ results: finderCache.results })
    .from(finderCache)
    .where(and(
      eq(finderCache.workspaceId, workspaceId),
      eq(finderCache.cacheKey, key),
      gt(finderCache.expiresAt, new Date()),
    ));
  if (!row) return null;
  try { return JSON.parse(row.results) as T; } catch { return null; }
}

export async function setCached<T>(workspaceId: string, key: string, data: T): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS);
  const results = JSON.stringify(data);
  await db.insert(finderCache)
    .values({ id: nanoid(16), workspaceId, cacheKey: key, results, expiresAt })
    .onConflictDoUpdate({
      target: [finderCache.workspaceId, finderCache.cacheKey],
      set: { results, expiresAt },
    });
}

// Purge stale entries (call opportunistically).
export async function purgeExpiredCache(): Promise<void> {
  await db.delete(finderCache).where(lt(finderCache.expiresAt, new Date()));
}
