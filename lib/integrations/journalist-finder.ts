// Journalist discovery via NewsAPI. Unlike the sentiment fetchNews helper,
// this keeps author and outlet (source name) as distinct fields so the PR
// contact finder can populate both on a new contact.

export type DiscoveredArticle = {
  author: string | null;
  outlet: string | null;
  title: string | null;
  url: string;
  publishedAt: Date | null;
};

const NEWS_ENDPOINT = "https://newsapi.org/v2/everything";

export async function fetchJournalistArticles(
  keyword: string,
  apiKey: string,
): Promise<DiscoveredArticle[]> {
  const params = new URLSearchParams({
    q: `"${keyword}"`,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "40",
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
      url?: string;
      author?: string;
      source?: { name?: string };
      publishedAt?: string;
    }[];
  };
  return (data.articles ?? [])
    .filter((a) => a.url)
    .map((a) => ({
      author: a.author ?? null,
      outlet: a.source?.name ?? null,
      title: a.title ?? null,
      url: a.url!,
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
    }));
}
