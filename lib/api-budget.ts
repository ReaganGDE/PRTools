// Self-imposed monthly spending caps for pay-as-you-go APIs.
// ScrapeCreators charges 1 credit per request; the workspace's monthly limit
// (Settings → Integrations) stops a runaway month. Consumption is atomic so
// concurrent requests can't blow past the cap.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiUsage, workspaces } from "@/lib/db/schema";

export const SC_PROVIDER = "scrapecreators";

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type ScrapeCreatorsBudget = {
  apiKey: string | null;
  limit: number;
  used: number;
  remaining: number;
  period: string;
};

export async function getScrapeCreatorsBudget(
  workspaceId: string,
): Promise<ScrapeCreatorsBudget> {
  const period = currentPeriod();
  const [ws] = await db
    .select({
      key: workspaces.scrapecreatorsKey,
      limit: workspaces.scrapecreatorsMonthlyLimit,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  const [usage] = await db
    .select({ used: apiUsage.used })
    .from(apiUsage)
    .where(
      and(
        eq(apiUsage.workspaceId, workspaceId),
        eq(apiUsage.provider, SC_PROVIDER),
        eq(apiUsage.period, period),
      ),
    );

  // Fall back to the env var so an ops-level key still works.
  const apiKey = ws?.key ?? process.env.SCRAPECREATORS_API_KEY ?? null;
  const limit = ws?.limit ?? 100;
  const used = usage?.used ?? 0;
  return {
    apiKey,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    period,
  };
}

// Atomically consume `n` credits if the monthly budget allows it.
// Returns true when the credits were reserved, false when the cap is hit.
export async function tryConsumeScCredits(
  workspaceId: string,
  n = 1,
): Promise<boolean> {
  const period = currentPeriod();
  const [ws] = await db
    .select({ limit: workspaces.scrapecreatorsMonthlyLimit })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  const limit = ws?.limit ?? 100;
  if (n > limit) return false;

  const rows = await db
    .insert(apiUsage)
    .values({ workspaceId, provider: SC_PROVIDER, period, used: n })
    .onConflictDoUpdate({
      target: [apiUsage.workspaceId, apiUsage.provider, apiUsage.period],
      set: { used: sql`${apiUsage.used} + ${n}` },
      setWhere: sql`${apiUsage.used} + ${n} <= ${limit}`,
    })
    .returning({ used: apiUsage.used });

  return rows.length > 0;
}
