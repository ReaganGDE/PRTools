import type { FetchedMention } from "./news";

export async function fetchYouTube(
  keyword: string,
  apiKey: string,
): Promise<FetchedMention[]> {
  const params = new URLSearchParams({
    part: "snippet",
    q: keyword,
    type: "video",
    order: "date",
    maxResults: "15",
    key: apiKey,
  });
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) return [];
    throw new Error(`YouTube ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        channelTitle?: string;
        publishedAt?: string;
      };
    }[];
  };
  const out: FetchedMention[] = [];
  for (const v of data.items ?? []) {
    if (!v.id?.videoId || !v.snippet?.title) continue;
    out.push({
      source: "youtube",
      url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
      title: v.snippet.title,
      body: v.snippet.description ?? null,
      author: v.snippet.channelTitle ?? null,
      publishedAt: v.snippet.publishedAt
        ? new Date(v.snippet.publishedAt)
        : null,
      keywordMatched: keyword,
    });
  }
  return out;
}
