// Deep engagement analysis for a single influencer (Upfluence-style profile
// report). YouTube works out of the box with YOUTUBE_API_KEY — profiles are
// resolved from a URL, @handle, channel ID, or plain name, and engagement is
// computed from the channel's recent uploads. Instagram/TikTok reports come
// from Modash when MODASH_API_KEY is set.

export type AnalyzedPost = {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  publishedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  engagementRate: number; // (likes+comments)/views, percentage
};

export type InfluencerAnalysis = {
  platform: "youtube" | "instagram" | "tiktok";
  externalId: string;
  name: string;
  handle: string | null;
  url: string;
  thumbnail: string | null;
  description: string | null;
  followers: number;
  totalViews: number;
  videoCount: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number; // percentage
  posts: AnalyzedPost[];
};

const YT_API = "https://www.googleapis.com/youtube/v3";

async function ytFetch<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${YT_API}/${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 403 || res.status === 429 || res.status === 404) {
      return null;
    }
    throw new Error(`YouTube ${path} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

type YtChannel = {
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
};

// Accepts a channel URL, @handle, raw channel ID (UC…), or a plain name.
async function resolveYouTubeChannel(
  input: string,
  apiKey: string,
): Promise<YtChannel | null> {
  const trimmed = input.trim();
  const part = "snippet,statistics,contentDetails";

  let channelId: string | null = null;
  let handle: string | null = null;

  const urlMatch = trimmed.match(
    /youtube\.com\/(?:channel\/(UC[\w-]+)|@([\w.-]+)|user\/([\w.-]+)|c\/([\w.-]+))/i,
  );
  if (urlMatch) {
    if (urlMatch[1]) channelId = urlMatch[1];
    else if (urlMatch[2]) handle = urlMatch[2];
    else handle = urlMatch[3] ?? urlMatch[4] ?? null;
  } else if (/^UC[\w-]{20,}$/.test(trimmed)) {
    channelId = trimmed;
  } else if (trimmed.startsWith("@")) {
    handle = trimmed.slice(1);
  }

  if (channelId) {
    const r = await ytFetch<{ items?: YtChannel[] }>(
      "channels",
      { part, id: channelId },
      apiKey,
    );
    return r?.items?.[0] ?? null;
  }

  if (handle) {
    const r = await ytFetch<{ items?: YtChannel[] }>(
      "channels",
      { part, forHandle: handle },
      apiKey,
    );
    if (r?.items?.[0]) return r.items[0];
  }

  // Plain name (or a handle lookup that missed) — search and take the top hit.
  const search = await ytFetch<{
    items?: { id?: { channelId?: string } }[];
  }>(
    "search",
    { part: "snippet", q: trimmed, type: "channel", maxResults: "1" },
    apiKey,
  );
  const foundId = search?.items?.[0]?.id?.channelId;
  if (!foundId) return null;
  const r = await ytFetch<{ items?: YtChannel[] }>(
    "channels",
    { part, id: foundId },
    apiKey,
  );
  return r?.items?.[0] ?? null;
}

export async function analyzeYouTube(
  input: string,
  apiKey: string,
  sampleSize = 12,
): Promise<InfluencerAnalysis | null> {
  const ch = await resolveYouTubeChannel(input, apiKey);
  if (!ch) return null;

  const posts: AnalyzedPost[] = [];
  const uploads = ch.contentDetails?.relatedPlaylists?.uploads;

  if (uploads) {
    const playlist = await ytFetch<{
      items?: { contentDetails?: { videoId?: string } }[];
    }>(
      "playlistItems",
      {
        part: "contentDetails",
        playlistId: uploads,
        maxResults: String(sampleSize),
      },
      apiKey,
    );
    const videoIds = (playlist?.items ?? [])
      .map((i) => i.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));

    if (videoIds.length > 0) {
      const videos = await ytFetch<{
        items?: {
          id: string;
          snippet?: {
            title?: string;
            publishedAt?: string;
            thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
          };
          statistics?: {
            viewCount?: string;
            likeCount?: string;
            commentCount?: string;
          };
        }[];
      }>(
        "videos",
        { part: "snippet,statistics", id: videoIds.join(",") },
        apiKey,
      );
      for (const v of videos?.items ?? []) {
        const views = Number(v.statistics?.viewCount ?? 0);
        const likes = Number(v.statistics?.likeCount ?? 0);
        const comments = Number(v.statistics?.commentCount ?? 0);
        posts.push({
          id: v.id,
          title: v.snippet?.title ?? "Untitled",
          url: `https://www.youtube.com/watch?v=${v.id}`,
          thumbnail:
            v.snippet?.thumbnails?.medium?.url ??
            v.snippet?.thumbnails?.default?.url ??
            null,
          publishedAt: v.snippet?.publishedAt ?? null,
          views,
          likes,
          comments,
          engagementRate:
            views > 0
              ? Math.round(((likes + comments) / views) * 100 * 100) / 100
              : 0,
        });
      }
    }
  }

  const viewed = posts.filter((p) => p.views > 0);
  const totalViews = viewed.reduce((s, p) => s + p.views, 0);
  const totalLikes = viewed.reduce((s, p) => s + p.likes, 0);
  const totalComments = viewed.reduce((s, p) => s + p.comments, 0);
  const n = Math.max(1, viewed.length);

  return {
    platform: "youtube",
    externalId: ch.id,
    name: ch.snippet?.title ?? "Unknown channel",
    handle: ch.snippet?.customUrl ?? null,
    url: `https://www.youtube.com/channel/${ch.id}`,
    thumbnail:
      ch.snippet?.thumbnails?.medium?.url ??
      ch.snippet?.thumbnails?.default?.url ??
      null,
    description: ch.snippet?.description ?? null,
    followers: Number(ch.statistics?.subscriberCount ?? 0),
    totalViews: Number(ch.statistics?.viewCount ?? 0),
    videoCount: Number(ch.statistics?.videoCount ?? 0),
    avgViews: viewed.length > 0 ? Math.round(totalViews / n) : 0,
    avgLikes: viewed.length > 0 ? Math.round(totalLikes / n) : 0,
    avgComments: viewed.length > 0 ? Math.round(totalComments / n) : 0,
    engagementRate:
      totalViews > 0
        ? Math.round(((totalLikes + totalComments) / totalViews) * 100 * 100) /
          100
        : 0,
    posts,
  };
}

// Instagram / TikTok profile report via Modash. Shapes are guarded so any
// API drift degrades to null instead of crashing.
export async function analyzeModash(
  platform: "instagram" | "tiktok",
  input: string,
  apiKey: string,
): Promise<InfluencerAnalysis | null> {
  const username = input
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\/@?/i, "")
    .replace(/[/?].*$/, "");
  if (!username) return null;

  try {
    const res = await fetch(
      `https://api.modash.io/v1/${platform}/profile/${encodeURIComponent(username)}/report`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      profile?: {
        profile?: {
          userId?: string;
          username?: string;
          fullname?: string;
          url?: string;
          picture?: string;
          followers?: number;
          engagementRate?: number;
          engagements?: number;
        };
        avgLikes?: number;
        avgComments?: number;
        avgViews?: number;
        recentPosts?: {
          id?: string;
          text?: string;
          url?: string;
          created?: string;
          likes?: number;
          comments?: number;
          views?: number;
          thumbnail?: string;
        }[];
      };
    };

    const p = data.profile?.profile;
    if (!p?.username) return null;

    const posts: AnalyzedPost[] = (data.profile?.recentPosts ?? []).map(
      (post, i) => {
        const views = post.views ?? 0;
        const likes = post.likes ?? 0;
        const comments = post.comments ?? 0;
        return {
          id: post.id ?? String(i),
          title: post.text?.slice(0, 120) ?? "Post",
          url: post.url ?? "",
          thumbnail: post.thumbnail ?? null,
          publishedAt: post.created ?? null,
          views,
          likes,
          comments,
          engagementRate:
            views > 0
              ? Math.round(((likes + comments) / views) * 100 * 100) / 100
              : 0,
        };
      },
    );

    return {
      platform,
      externalId: p.username,
      name: p.fullname || p.username,
      handle: p.username,
      url:
        p.url ??
        (platform === "instagram"
          ? `https://instagram.com/${p.username}`
          : `https://www.tiktok.com/@${p.username}`),
      thumbnail: p.picture ?? null,
      description: null,
      followers: p.followers ?? 0,
      totalViews: 0,
      videoCount: 0,
      avgViews: data.profile?.avgViews ?? 0,
      avgLikes: data.profile?.avgLikes ?? 0,
      avgComments: data.profile?.avgComments ?? 0,
      // Modash reports engagementRate as a fraction (0.042 = 4.2%).
      engagementRate:
        typeof p.engagementRate === "number"
          ? Math.round(p.engagementRate * 100 * 100) / 100
          : 0,
      posts,
    };
  } catch {
    return null;
  }
}

// Fetch just the current headline metrics for a tracked influencer —
// used by the tracking page's "Refresh metrics" snapshots.
export async function fetchCurrentMetrics(tracked: {
  platform: string;
  externalId: string;
}): Promise<{
  followers: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
} | null> {
  if (tracked.platform === "youtube") {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return null;
    const a = await analyzeYouTube(tracked.externalId, key, 10);
    if (!a) return null;
    return {
      followers: a.followers,
      avgViews: a.avgViews,
      avgLikes: a.avgLikes,
      avgComments: a.avgComments,
      engagementRate: a.engagementRate,
    };
  }
  if (tracked.platform === "instagram" || tracked.platform === "tiktok") {
    const scKey = process.env.SCRAPECREATORS_API_KEY;
    const modashKey = process.env.MODASH_API_KEY;
    let a: InfluencerAnalysis | null = null;
    if (scKey) {
      const { scAnalyzeInstagram, scAnalyzeTikTok } = await import(
        "./scrapecreators"
      );
      a =
        tracked.platform === "instagram"
          ? await scAnalyzeInstagram(tracked.externalId, scKey)
          : await scAnalyzeTikTok(tracked.externalId, scKey);
    }
    if (!a && modashKey) {
      a = await analyzeModash(tracked.platform, tracked.externalId, modashKey);
    }
    if (!a) return null;
    return {
      followers: a.followers,
      avgViews: a.avgViews,
      avgLikes: a.avgLikes,
      avgComments: a.avgComments,
      engagementRate: a.engagementRate,
    };
  }
  return null;
}
