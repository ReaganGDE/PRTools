// YouTube influencer discovery + metrics via the YouTube Data API v3.
// Searches channels by niche/keyword, then computes real engagement stats
// (average views per recent upload, engagement % = (likes+comments)/views)
// from each channel's most recent videos.

export type InfluencerResult = {
  platform: "youtube" | "instagram" | "tiktok";
  channelId: string;
  name: string;
  handle: string | null;
  url: string;
  thumbnail: string | null;
  description: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  avgViews: number;
  engagementRate: number; // percentage, e.g. 4.2 means 4.2%
};

const API = "https://www.googleapis.com/youtube/v3";

async function ytFetch<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${API}/${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) {
    // Quota exhausted / forbidden — degrade gracefully rather than 500.
    if (res.status === 403 || res.status === 429) return null;
    throw new Error(`YouTube ${path} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function findYouTubeInfluencers(
  query: string,
  apiKey: string,
  maxChannels = 8,
): Promise<InfluencerResult[]> {
  // 1) Find candidate channels by keyword.
  const search = await ytFetch<{
    items?: { id?: { channelId?: string } }[];
  }>(
    "search",
    {
      part: "snippet",
      q: query,
      type: "channel",
      maxResults: String(maxChannels),
      order: "relevance",
    },
    apiKey,
  );
  if (!search) return [];
  const channelIds = (search.items ?? [])
    .map((i) => i.id?.channelId)
    .filter((id): id is string => Boolean(id));
  if (channelIds.length === 0) return [];

  // 2) Fetch channel statistics + uploads playlist in one batched call.
  const channels = await ytFetch<{
    items?: {
      id: string;
      snippet?: {
        title?: string;
        description?: string;
        customUrl?: string;
        thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
      };
      statistics?: {
        subscriberCount?: string;
        viewCount?: string;
        videoCount?: string;
      };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }[];
  }>(
    "channels",
    {
      part: "snippet,statistics,contentDetails",
      id: channelIds.join(","),
    },
    apiKey,
  );
  if (!channels) return [];

  const results: InfluencerResult[] = [];
  for (const ch of channels.items ?? []) {
    const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
    const { avgViews, engagementRate } = uploads
      ? await recentEngagement(uploads, apiKey)
      : { avgViews: 0, engagementRate: 0 };

    results.push({
      platform: "youtube",
      channelId: ch.id,
      name: ch.snippet?.title ?? "Unknown channel",
      handle: ch.snippet?.customUrl ?? null,
      url: `https://www.youtube.com/channel/${ch.id}`,
      thumbnail:
        ch.snippet?.thumbnails?.medium?.url ??
        ch.snippet?.thumbnails?.default?.url ??
        null,
      description: ch.snippet?.description ?? null,
      subscribers: Number(ch.statistics?.subscriberCount ?? 0),
      totalViews: Number(ch.statistics?.viewCount ?? 0),
      videoCount: Number(ch.statistics?.videoCount ?? 0),
      avgViews,
      engagementRate,
    });
  }

  // Most relevant first, but break ties toward higher engagement.
  return results;
}

// Pull the channel's most recent uploads and compute average views and a
// blended engagement rate across them.
async function recentEngagement(
  uploadsPlaylistId: string,
  apiKey: string,
  sampleSize = 10,
): Promise<{ avgViews: number; engagementRate: number }> {
  const playlist = await ytFetch<{
    items?: { contentDetails?: { videoId?: string } }[];
  }>(
    "playlistItems",
    {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(sampleSize),
    },
    apiKey,
  );
  const videoIds = (playlist?.items ?? [])
    .map((i) => i.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
  if (videoIds.length === 0) return { avgViews: 0, engagementRate: 0 };

  const videos = await ytFetch<{
    items?: {
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
    }[];
  }>(
    "videos",
    { part: "statistics", id: videoIds.join(",") },
    apiKey,
  );
  const items = videos?.items ?? [];
  if (items.length === 0) return { avgViews: 0, engagementRate: 0 };

  let totalViews = 0;
  let totalEngagements = 0;
  let counted = 0;
  for (const v of items) {
    const views = Number(v.statistics?.viewCount ?? 0);
    if (views <= 0) continue;
    const likes = Number(v.statistics?.likeCount ?? 0);
    const comments = Number(v.statistics?.commentCount ?? 0);
    totalViews += views;
    totalEngagements += likes + comments;
    counted++;
  }
  if (counted === 0) return { avgViews: 0, engagementRate: 0 };

  const avgViews = Math.round(totalViews / counted);
  const engagementRate =
    totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;
  return {
    avgViews,
    engagementRate: Math.round(engagementRate * 100) / 100,
  };
}
