// Reddit posting + DM client.
// Uses "script" app auth flow — works for posting/messaging from a single account.
// Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT,
// REDDIT_USERNAME, REDDIT_PASSWORD in env.

let cached: { token: string; expiresAt: number } | null = null;

async function getUserToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  const ua = process.env.REDDIT_USER_AGENT;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  if (!id || !secret || !ua || !username || !password) {
    throw new Error(
      "Reddit not fully configured. Need REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT, REDDIT_USERNAME, REDDIT_PASSWORD.",
    );
  }
  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
  });
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Reddit auth ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    error?: string;
  };
  if (data.error) throw new Error(`Reddit auth error: ${data.error}`);
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function submitRedditPost(args: {
  subreddit: string;
  title: string;
  body?: string;
  url?: string;
}): Promise<{ id: string; url: string }> {
  const token = await getUserToken();
  const ua = process.env.REDDIT_USER_AGENT!;
  const form = new URLSearchParams({
    api_type: "json",
    sr: args.subreddit.replace(/^r\//, ""),
    title: args.title,
    kind: args.url ? "link" : "self",
    ...(args.url ? { url: args.url } : { text: args.body ?? "" }),
  });

  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": ua,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Reddit submit ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    json?: {
      errors?: [string, string][];
      data?: { id?: string; name?: string; url?: string };
    };
  };
  if (data.json?.errors && data.json.errors.length > 0) {
    throw new Error(`Reddit error: ${JSON.stringify(data.json.errors)}`);
  }
  const id = data.json?.data?.name ?? data.json?.data?.id ?? "";
  const url = data.json?.data?.url ?? "";
  return { id, url };
}

export async function sendRedditDm(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const token = await getUserToken();
  const ua = process.env.REDDIT_USER_AGENT!;
  const form = new URLSearchParams({
    api_type: "json",
    to: args.to,
    subject: args.subject,
    text: args.body,
  });
  const res = await fetch("https://oauth.reddit.com/api/compose", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": ua,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Reddit compose ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    json?: { errors?: [string, string][] };
  };
  if (data.json?.errors && data.json.errors.length > 0) {
    throw new Error(`Reddit error: ${JSON.stringify(data.json.errors)}`);
  }
}
