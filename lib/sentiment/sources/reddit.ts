import type { FetchedMention } from "./news";

// Reddit "app-only" auth — works for read endpoints without per-user OAuth.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppToken(
  clientId: string,
  clientSecret: string,
  userAgent: string,
): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Reddit OAuth ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function fetchReddit(
  keyword: string,
  args: {
    clientId: string;
    clientSecret: string;
    userAgent: string;
  },
): Promise<FetchedMention[]> {
  const token = await getAppToken(
    args.clientId,
    args.clientSecret,
    args.userAgent,
  );
  const params = new URLSearchParams({
    q: `"${keyword}"`,
    limit: "25",
    sort: "new",
    type: "link",
  });
  const res = await fetch(
    `https://oauth.reddit.com/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": args.userAgent,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    if (res.status === 429) return [];
    throw new Error(`Reddit ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data?: {
      children?: {
        data?: {
          id?: string;
          title?: string;
          selftext?: string;
          author?: string;
          permalink?: string;
          created_utc?: number;
        };
      }[];
    };
  };
  const out: FetchedMention[] = [];
  for (const c of data.data?.children ?? []) {
    const d = c.data;
    if (!d?.permalink || !d.title) continue;
    out.push({
      source: "reddit",
      url: `https://www.reddit.com${d.permalink}`,
      title: d.title,
      body: d.selftext ?? null,
      author: d.author ?? null,
      publishedAt: d.created_utc ? new Date(d.created_utc * 1000) : null,
      keywordMatched: keyword,
    });
  }
  return out;
}
