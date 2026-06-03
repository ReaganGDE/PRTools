// Instagram / TikTok influencer discovery via Modash (https://modash.io).
// This is a paid API — when MODASH_API_KEY is unset the influencer finder
// surfaces a "connect a key" hint instead of results for these platforms.
//
// The request/response shapes below follow Modash's Discovery API. They are
// guarded so that any contract drift degrades gracefully to an empty list
// rather than crashing the page; verify against current Modash docs when you
// enable a key.
import type { InfluencerResult } from "./youtube-influencers";

const API = "https://api.modash.io/v1";

export type ModashPlatform = "instagram" | "tiktok";

export function modashConfigured(apiKey: string | undefined): boolean {
  return Boolean(apiKey);
}

export async function findModashInfluencers(
  platform: ModashPlatform,
  query: string,
  apiKey: string,
  limit = 8,
): Promise<InfluencerResult[]> {
  try {
    const res = await fetch(`${API}/${platform}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
      body: JSON.stringify({
        page: 0,
        limit,
        sort: { field: "followers", direction: "desc" },
        filter: { influencer: { keywords: query } },
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      directs?: {
        userId?: string;
        profile?: {
          username?: string;
          fullname?: string;
          url?: string;
          picture?: string;
          followers?: number;
          engagements?: number;
          engagementRate?: number;
          avgLikes?: number;
        };
      }[];
    };

    return (data.directs ?? [])
      .filter((d) => d.profile?.username)
      .map((d) => {
        const p = d.profile!;
        const followers = p.followers ?? 0;
        // Modash returns engagementRate as a fraction (0.042 = 4.2%).
        const engagementRate =
          typeof p.engagementRate === "number"
            ? Math.round(p.engagementRate * 100 * 100) / 100
            : 0;
        const avgViews = p.avgLikes ?? p.engagements ?? 0;
        return {
          platform: platform as InfluencerResult["platform"],
          channelId: d.userId ?? p.username!,
          name: p.fullname || p.username!,
          handle: p.username ?? null,
          url:
            p.url ??
            (platform === "instagram"
              ? `https://instagram.com/${p.username}`
              : `https://www.tiktok.com/@${p.username}`),
          thumbnail: p.picture ?? null,
          description: null,
          subscribers: followers,
          totalViews: 0,
          videoCount: 0,
          avgViews,
          engagementRate,
        } satisfies InfluencerResult;
      });
  } catch {
    return [];
  }
}
