"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trackedInfluencers, influencerSnapshots } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { assertSectionAccess } from "@/lib/tool-access";
import { env } from "@/lib/env";
import {
  analyzeYouTube,
  analyzeModash,
  type InfluencerAnalysis,
} from "@/lib/integrations/influencer-analyzer";
import { getCached, setCached } from "@/lib/finder-cache";

export type AnalyzeResult = {
  analysis: InfluencerAnalysis | null;
  alreadyTracked: boolean;
  notes: string[];
};

export async function analyzeInfluencer(
  formData: FormData,
): Promise<AnalyzeResult> {
  await assertSectionAccess("social");
  const session = await requireSession();

  const input = String(formData.get("query") ?? "").trim();
  const platform = String(formData.get("platform") ?? "youtube") as
    | "youtube"
    | "instagram"
    | "tiktok";
  const notes: string[] = [];

  if (!input) return { analysis: null, alreadyTracked: false, notes };

  const cacheKey = `analyze:${platform}:${input.toLowerCase()}`;
  let analysis = await getCached<InfluencerAnalysis>(
    session.workspaceId,
    cacheKey,
  );
  if (analysis) {
    notes.push("Results from cache (refreshed daily).");
  } else {
    if (platform === "youtube") {
      if (!env.YOUTUBE_API_KEY) {
        notes.push("YouTube analysis needs YOUTUBE_API_KEY.");
        return { analysis: null, alreadyTracked: false, notes };
      }
      analysis = await analyzeYouTube(input, env.YOUTUBE_API_KEY);
    } else {
      if (!env.MODASH_API_KEY) {
        notes.push(
          `${platform === "instagram" ? "Instagram" : "TikTok"} analysis needs a Modash/HypeAuditor key (MODASH_API_KEY).`,
        );
        return { analysis: null, alreadyTracked: false, notes };
      }
      analysis = await analyzeModash(platform, input, env.MODASH_API_KEY);
    }
    if (analysis) await setCached(session.workspaceId, cacheKey, analysis);
  }

  if (!analysis) {
    notes.push("No profile found for that handle or URL.");
    return { analysis: null, alreadyTracked: false, notes };
  }

  const [existing] = await db
    .select({ id: trackedInfluencers.id })
    .from(trackedInfluencers)
    .where(
      and(
        eq(trackedInfluencers.workspaceId, session.workspaceId),
        eq(trackedInfluencers.platform, analysis.platform),
        eq(trackedInfluencers.externalId, analysis.externalId),
      ),
    )
    .limit(1);

  return { analysis, alreadyTracked: Boolean(existing), notes };
}

export type TrackResult = { tracked: boolean; reason?: string };

// Start tracking an influencer and record their current metrics as the
// first snapshot, so growth deltas have a baseline immediately.
export async function trackInfluencer(formData: FormData): Promise<TrackResult> {
  await assertSectionAccess("social");
  const session = await requireSession();

  const platform = String(formData.get("platform") ?? "") as
    | "youtube"
    | "instagram"
    | "tiktok";
  const externalId = String(formData.get("externalId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const handle = String(formData.get("handle") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim();
  const thumbnail = String(formData.get("thumbnail") ?? "").trim() || null;
  const followers = Number(formData.get("followers") ?? 0) || 0;
  const avgViews = Number(formData.get("avgViews") ?? 0) || 0;
  const avgLikes = Number(formData.get("avgLikes") ?? 0) || 0;
  const avgComments = Number(formData.get("avgComments") ?? 0) || 0;
  const engagementRate = Number(formData.get("engagementRate") ?? 0) || 0;

  if (!externalId || !name || !url) {
    return { tracked: false, reason: "Missing profile details" };
  }

  const [dupe] = await db
    .select({ id: trackedInfluencers.id })
    .from(trackedInfluencers)
    .where(
      and(
        eq(trackedInfluencers.workspaceId, session.workspaceId),
        eq(trackedInfluencers.platform, platform),
        eq(trackedInfluencers.externalId, externalId),
      ),
    )
    .limit(1);
  if (dupe) return { tracked: false, reason: "Already tracked" };

  const [row] = await db
    .insert(trackedInfluencers)
    .values({
      workspaceId: session.workspaceId,
      platform,
      externalId,
      name,
      handle,
      url,
      thumbnail,
      createdBy: session.userId,
    })
    .returning({ id: trackedInfluencers.id });

  await db.insert(influencerSnapshots).values({
    trackedInfluencerId: row.id,
    followers,
    avgViews,
    avgLikes,
    avgComments,
    engagementRate,
  });

  revalidatePath("/influencers/tracked");
  return { tracked: true };
}
