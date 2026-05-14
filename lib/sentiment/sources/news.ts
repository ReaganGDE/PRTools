export type FetchedMention = {
  source: "news" | "reddit" | "youtube";
  url: string;
  title: string | null;
  body: string | null;
  author: string | null;
  publishedAt: Date | null;
  keywordMatched: string;
};

const NEWS_ENDPOINT = "https://newsapi.org/v2/everything";

export async function fetchNews(
  keyword: string,
  apiKey: string,
): Promise<FetchedMention[]> {
  const params = new URLSearchParams({
    q: `"${keyword}"`,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "20",
  });
  const res = await fetch(`${NEWS_ENDPOINT}?${params}`, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 426 || res.status === 429) return [];
    throw new Error(`NewsAPI ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    articles?: {
      title?: string;
      description?: string;
      content?: string;
      url?: string;
      author?: string;
      source?: { name?: string };
      publishedAt?: string;
    }[];
  };
  return (data.articles ?? [])
    .filter((a) => a.url && a.title)
    .map((a) => ({
      source: "news" as const,
      url: a.url!,
      title: a.title ?? null,
      body: a.description ?? a.content ?? null,
      author: a.author ?? a.source?.name ?? null,
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
      keywordMatched: keyword,
    }));
}
