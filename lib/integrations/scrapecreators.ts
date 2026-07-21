// Instagram / TikTok profile analysis via ScrapeCreators
// (https://scrapecreators.com) — pay-as-you-go public-data API (~$10 per 5k
// requests, 100 free credits to test, no subscription). Auth is an x-api-key
// header; one request = one credit.
//
// Response shapes are guarded defensively: ScrapeCreators generally relays
// each platform's own public JSON (Instagram web_profile_info, TikTok user
// detail), but any drift degrades to null instead of crashing. Verify against
// https://docs.scrapecreators.com when enabling a key.
import type {
  AnalyzedPost,
  InfluencerAnalysis,
} from "./influencer-analyzer";

const API = "https://api.scrapecreators.com";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Dig the first numeric value found at any of the given paths.
function pick(obj: unknown, paths: string[][]): number {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path) {
      if (cur && typeof cur === "object" && key in (cur as object)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    if (cur != null && Number.isFinite(Number(cur))) return Number(cur);
  }
  return 0;
}

function pickStr(obj: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path) {
      if (cur && typeof cur === "object" && key in (cur as object)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur.length > 0) return cur;
  }
  return null;
}

async function scFetch(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<unknown | null> {
  const qs = new URLSearchParams(params);
  try {
    const res = await fetch(`${API}${path}?${qs}`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function normalizeHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\/@?/i, "")
    .replace(/^@/, "")
    .replace(/[/?].*$/, "");
}

export async function scAnalyzeInstagram(
  input: string,
  apiKey: string,
): Promise<InfluencerAnalysis | null> {
  const handle = normalizeHandle(input);
  if (!handle) return null;

  const data = await scFetch(
    "/v1/instagram/profile",
    { handle },
    apiKey,
  );
  if (!data) return null;

  // Instagram's web_profile_info shape: { data: { user: {...} } }; some
  // providers flatten it to { user: {...} } or return the user directly.
  const root = data as Record<string, unknown>;
  const user =
    (root.data as Record<string, unknown> | undefined)?.user ??
    root.user ??
    root;
  if (!user || typeof user !== "object") return null;

  const username = pickStr(user, [["username"]]) ?? handle;
  const followers = pick(user, [
    ["edge_followed_by", "count"],
    ["follower_count"],
    ["followers"],
    ["followersCount"],
  ]);
  if (followers <= 0 && !pickStr(user, [["full_name"], ["fullName"]])) {
    return null;
  }

  // Recent posts ride along on the profile response in Instagram's shape.
  const mediaEdges =
    ((user as Record<string, unknown>).edge_owner_to_timeline_media as
      | { count?: number; edges?: { node?: Record<string, unknown> }[] }
      | undefined) ?? undefined;

  const posts: AnalyzedPost[] = [];
  for (const edge of mediaEdges?.edges ?? []) {
    const node = edge.node;
    if (!node) continue;
    const likes = pick(node, [
      ["edge_liked_by", "count"],
      ["edge_media_preview_like", "count"],
      ["like_count"],
    ]);
    const comments = pick(node, [
      ["edge_media_to_comment", "count"],
      ["comment_count"],
    ]);
    const views = pick(node, [["video_view_count"], ["view_count"]]);
    const shortcode = pickStr(node, [["shortcode"]]);
    const caption =
      pickStr(node, [
        ["edge_media_to_caption", "edges", "0", "node", "text"],
        ["caption"],
      ]) ?? "Post";
    const takenAt = pick(node, [["taken_at_timestamp"]]);
    posts.push({
      id: pickStr(node, [["id"]]) ?? shortcode ?? String(posts.length),
      title: caption.slice(0, 120),
      url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : "",
      thumbnail: pickStr(node, [["thumbnail_src"], ["display_url"]]),
      publishedAt: takenAt > 0 ? new Date(takenAt * 1000).toISOString() : null,
      views,
      likes,
      comments,
      // Instagram's standard engagement basis is followers, not views.
      engagementRate:
        followers > 0
          ? Math.round(((likes + comments) / followers) * 100 * 100) / 100
          : 0,
    });
  }

  const n = Math.max(1, posts.length);
  const avgLikes = posts.length
    ? Math.round(posts.reduce((s, p) => s + p.likes, 0) / n)
    : 0;
  const avgComments = posts.length
    ? Math.round(posts.reduce((s, p) => s + p.comments, 0) / n)
    : 0;
  const viewed = posts.filter((p) => p.views > 0);
  const avgViews = viewed.length
    ? Math.round(viewed.reduce((s, p) => s + p.views, 0) / viewed.length)
    : 0;

  return {
    platform: "instagram",
    externalId: username,
    name: pickStr(user, [["full_name"], ["fullName"]]) ?? username,
    handle: username,
    url: `https://www.instagram.com/${username}/`,
    thumbnail: pickStr(user, [
      ["profile_pic_url_hd"],
      ["profile_pic_url"],
      ["avatar"],
    ]),
    description: pickStr(user, [["biography"], ["bio"]]),
    followers,
    totalViews: 0,
    videoCount: num(mediaEdges?.count),
    avgViews,
    avgLikes,
    avgComments,
    engagementRate:
      followers > 0
        ? Math.round(((avgLikes + avgComments) / followers) * 100 * 100) / 100
        : 0,
    posts,
  };
}

export async function scAnalyzeTikTok(
  input: string,
  apiKey: string,
): Promise<InfluencerAnalysis | null> {
  const handle = normalizeHandle(input);
  if (!handle) return null;

  const data = await scFetch("/v1/tiktok/profile", { handle }, apiKey);
  if (!data) return null;

  // TikTok's user-detail shape: { user: {...}, stats: {...} }, sometimes
  // nested under userInfo.
  const root = data as Record<string, unknown>;
  const container =
    (root.userInfo as Record<string, unknown> | undefined) ?? root;
  const user =
    (container.user as Record<string, unknown> | undefined) ?? container;
  const stats =
    (container.stats as Record<string, unknown> | undefined) ??
    (container.statsV2 as Record<string, unknown> | undefined) ??
    {};

  const username =
    pickStr(user, [["uniqueId"], ["unique_id"], ["username"]]) ?? handle;
  const followers = pick(stats, [
    ["followerCount"],
    ["follower_count"],
    ["followers"],
  ]);
  const videoCount = pick(stats, [["videoCount"], ["video_count"]]);
  const totalHearts = pick(stats, [
    ["heartCount"],
    ["heart"],
    ["diggCount"],
    ["likes_count"],
  ]);
  if (followers <= 0 && videoCount <= 0) return null;

  const avgLikes =
    videoCount > 0 ? Math.round(totalHearts / videoCount) : 0;

  return {
    platform: "tiktok",
    externalId: username,
    name: pickStr(user, [["nickname"], ["fullName"]]) ?? username,
    handle: username,
    url: `https://www.tiktok.com/@${username}`,
    thumbnail: pickStr(user, [
      ["avatarLarger"],
      ["avatarMedium"],
      ["avatarThumb"],
      ["avatar"],
    ]),
    description: pickStr(user, [["signature"], ["bio"]]),
    followers,
    totalViews: 0,
    videoCount,
    avgViews: 0,
    avgLikes,
    avgComments: 0,
    // Lifetime likes per video against followers — a rough but honest ER
    // proxy given the profile endpoint doesn't include per-video stats.
    engagementRate:
      followers > 0 && avgLikes > 0
        ? Math.round((avgLikes / followers) * 100 * 100) / 100
        : 0,
    posts: [],
  };
}
