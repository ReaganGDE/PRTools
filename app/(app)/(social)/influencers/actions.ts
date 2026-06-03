"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { requireSession, requireSessionWithCap } from "@/lib/auth-helpers";
import { assertSectionAccess } from "@/lib/tool-access";
import { env } from "@/lib/env";
import {
  findYouTubeInfluencers,
  type InfluencerResult,
} from "@/lib/integrations/youtube-influencers";
import { findModashInfluencers, modashConfigured } from "@/lib/integrations/modash";
import { getCached, setCached, purgeExpiredCache } from "@/lib/finder-cache";

export type InfluencerSearchResult = {
  results: InfluencerResult[];
  modashEnabled: boolean;
  youtubeEnabled: boolean;
  notes: string[];
};

export async function searchInfluencers(
  formData: FormData,
): Promise<InfluencerSearchResult> {
  await assertSectionAccess("social");
  const session = await requireSession();

  const query = String(formData.get("query") ?? "").trim();
  const platforms = formData.getAll("platforms").map(String);
  const notes: string[] = [];

  const youtubeEnabled = Boolean(env.YOUTUBE_API_KEY);
  const modashEnabled = modashConfigured(env.MODASH_API_KEY);

  if (!query) return { results: [], modashEnabled, youtubeEnabled, notes };

  const cacheKey = `influencer:${query}:${[...platforms].sort().join(",")}`;

  // Check cache first
  const cached = await getCached<InfluencerResult[]>(session.workspaceId, cacheKey);
  if (cached) {
    return { results: cached, modashEnabled, youtubeEnabled, notes: ["Results from cache."] };
  }

  const wantYouTube = platforms.length === 0 || platforms.includes("youtube");
  const wantInstagram = platforms.includes("instagram");
  const wantTiktok = platforms.includes("tiktok");

  const tasks: Promise<InfluencerResult[]>[] = [];

  if (wantYouTube) {
    if (youtubeEnabled) {
      tasks.push(findYouTubeInfluencers(query, env.YOUTUBE_API_KEY!));
    } else {
      notes.push("YouTube search needs YOUTUBE_API_KEY.");
    }
  }
  if (wantInstagram) {
    if (modashEnabled) {
      tasks.push(findModashInfluencers("instagram", query, env.MODASH_API_KEY!));
    } else {
      notes.push("Instagram needs a Modash/HypeAuditor key (MODASH_API_KEY).");
    }
  }
  if (wantTiktok) {
    if (modashEnabled) {
      tasks.push(findModashInfluencers("tiktok", query, env.MODASH_API_KEY!));
    } else {
      notes.push("TikTok needs a Modash/HypeAuditor key (MODASH_API_KEY).");
    }
  }

  const settled = await Promise.all(tasks);
  const results = settled.flat();
  // Highest engagement first within the combined set.
  results.sort((a, b) => b.engagementRate - a.engagementRate);

  // Store in cache and purge stale entries opportunistically
  await setCached(session.workspaceId, cacheKey, results);
  void purgeExpiredCache();

  return { results, modashEnabled, youtubeEnabled, notes };
}

export type AddInfluencerResult = { added: boolean; reason?: string };

export async function addInfluencerContact(
  formData: FormData,
): Promise<AddInfluencerResult> {
  const session = await requireSessionWithCap("contacts.create");
  await assertSectionAccess("social");

  const platform = String(formData.get("platform") ?? "") as
    | "youtube"
    | "instagram"
    | "tiktok";
  const name = String(formData.get("name") ?? "").trim();
  const handle = String(formData.get("handle") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim() || null;
  const followers = Number(formData.get("followers") ?? 0) || null;
  const avgViews = String(formData.get("avgViews") ?? "");
  const engagementRate = String(formData.get("engagementRate") ?? "");
  if (!name) return { added: false, reason: "Missing name" };

  // De-dupe by platform handle within the workspace.
  const handleCol =
    platform === "instagram"
      ? contacts.handleInstagram
      : platform === "tiktok"
        ? contacts.handleTiktok
        : contacts.handleYoutube;
  if (handle) {
    const [dupe] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(eq(contacts.workspaceId, session.workspaceId), eq(handleCol, handle)),
      )
      .limit(1);
    if (dupe) return { added: false, reason: "Already in contacts" };
  }

  const sourceByPlatform = {
    youtube: "youtube_discover",
    instagram: "ig_discover",
    tiktok: "youtube_discover",
  } as const;

  const metricLine = [
    avgViews ? `Avg views: ${Number(avgViews).toLocaleString()}` : null,
    engagementRate ? `Engagement: ${engagementRate}%` : null,
    url,
  ]
    .filter(Boolean)
    .join(" · ");

  await db.insert(contacts).values({
    id: nanoid(16),
    workspaceId: session.workspaceId,
    type: "influencer",
    name,
    primaryPlatform: platform,
    handleYoutube: platform === "youtube" ? handle : undefined,
    handleInstagram: platform === "instagram" ? handle : undefined,
    handleTiktok: platform === "tiktok" ? handle : undefined,
    followerCount: followers,
    source: sourceByPlatform[platform] ?? "manual",
    notes: metricLine || null,
  });

  revalidatePath("/influencers");
  revalidatePath("/contacts");
  return { added: true };
}
