"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  trackedInfluencers,
  influencerSnapshots,
  keywords,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { assertSectionAccess } from "@/lib/tool-access";
import { fetchCurrentMetrics } from "@/lib/integrations/influencer-analyzer";
import {
  scAnalyzeInstagram,
  scAnalyzeTikTok,
} from "@/lib/integrations/scrapecreators";
import {
  getScrapeCreatorsBudget,
  tryConsumeScCredits,
} from "@/lib/api-budget";

export async function untrackInfluencer(id: string, _formData: FormData) {
  await assertSectionAccess("social");
  const session = await requireSession();

  await db
    .delete(trackedInfluencers)
    .where(
      and(
        eq(trackedInfluencers.id, id),
        eq(trackedInfluencers.workspaceId, session.workspaceId),
      ),
    );

  revalidatePath("/influencers/tracked");
}

// Re-fetch current metrics for every tracked influencer in the workspace and
// append a snapshot for each one that resolves.
export async function refreshAllMetrics(_formData?: FormData) {
  await assertSectionAccess("social");
  const session = await requireSession();

  const tracked = await db
    .select()
    .from(trackedInfluencers)
    .where(eq(trackedInfluencers.workspaceId, session.workspaceId));

  const budget = await getScrapeCreatorsBudget(session.workspaceId);

  for (const t of tracked) {
    try {
      let m: Awaited<ReturnType<typeof fetchCurrentMetrics>> = null;
      // Instagram/TikTok via ScrapeCreators is credit-metered against the
      // workspace's monthly cap; skip (not fail) once the cap is reached.
      if (
        (t.platform === "instagram" || t.platform === "tiktok") &&
        budget.apiKey
      ) {
        if (await tryConsumeScCredits(session.workspaceId, 1)) {
          const a =
            t.platform === "instagram"
              ? await scAnalyzeInstagram(t.externalId, budget.apiKey)
              : await scAnalyzeTikTok(t.externalId, budget.apiKey);
          if (a) {
            m = {
              followers: a.followers,
              avgViews: a.avgViews,
              avgLikes: a.avgLikes,
              avgComments: a.avgComments,
              engagementRate: a.engagementRate,
            };
          }
        }
      }
      if (!m) m = await fetchCurrentMetrics(t);
      if (!m) continue;
      await db.insert(influencerSnapshots).values({
        trackedInfluencerId: t.id,
        followers: m.followers,
        avgViews: m.avgViews,
        avgLikes: m.avgLikes,
        avgComments: m.avgComments,
        engagementRate: m.engagementRate,
      });
    } catch {
      // A single failing profile shouldn't abort the whole refresh.
    }
  }

  revalidatePath("/influencers/tracked");
}

// Add the influencer's name as a listening keyword so the sentiment engine
// starts picking up mentions of them across news/Reddit/YouTube.
export async function listenToInfluencer(id: string, _formData: FormData) {
  await assertSectionAccess("social");
  const session = await requireSession();

  const [t] = await db
    .select({ name: trackedInfluencers.name })
    .from(trackedInfluencers)
    .where(
      and(
        eq(trackedInfluencers.id, id),
        eq(trackedInfluencers.workspaceId, session.workspaceId),
      ),
    )
    .limit(1);
  if (!t) throw new Error("Tracked influencer not found");

  const [existing] = await db
    .select({ id: keywords.id })
    .from(keywords)
    .where(
      and(
        eq(keywords.workspaceId, session.workspaceId),
        eq(keywords.term, t.name),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(keywords)
      .set({ active: true })
      .where(eq(keywords.id, existing.id));
  } else {
    await db.insert(keywords).values({
      workspaceId: session.workspaceId,
      term: t.name,
      active: true,
    });
  }

  revalidatePath("/influencers/tracked");
  revalidatePath("/sentiment");
}
