// OneUp API client.
// Docs: https://docs.oneupapp.io/docs/overview
// Auth: apiKey as a query parameter. Set ONEUP_API_KEY in env.

const BASE = "https://www.oneupapp.io";

function apiKey(): string {
  const k = process.env.ONEUP_API_KEY;
  if (!k) throw new Error("ONEUP_API_KEY is not set");
  return k;
}

type OneUpEnvelope<T> = {
  message: string;
  error: boolean;
  data: T;
};

export type OneUpCategory = {
  id: number;
  category_name: string;
  isPaused: number;
  created_at: string;
};

export type OneUpCategoryAccount = {
  category_id: number;
  social_network_name: string;
  social_network_id: string;
  social_network_type: string;
};

export type OneUpSocialAccount = {
  username: string;
  full_name: string;
  is_expired: number;
  social_network_type: string;
  need_refresh: boolean;
};

async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ apiKey: apiKey(), ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`OneUp ${path} ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as OneUpEnvelope<T>;
  if (json.error) throw new Error(`OneUp ${path}: ${json.message}`);
  return json.data;
}

async function postForm(
  path: string,
  fields: Record<string, string>,
): Promise<{ message: string }> {
  const body = new URLSearchParams({ apiKey: apiKey(), ...fields });
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OneUp ${path} ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { message: string; error: boolean };
  if (json.error) throw new Error(`OneUp ${path}: ${json.message}`);
  return { message: json.message };
}

export function listCategories(): Promise<OneUpCategory[]> {
  return getJson<OneUpCategory[]>("/api/listcategory", {});
}

export function listCategoryAccounts(
  categoryId: string | number,
): Promise<OneUpCategoryAccount[]> {
  return getJson<OneUpCategoryAccount[]>("/api/listcategoryaccount", {
    category_id: String(categoryId),
  });
}

export function listSocialAccounts(): Promise<OneUpSocialAccount[]> {
  return getJson<OneUpSocialAccount[]>("/api/listsocialaccounts", {});
}

// Pre-signed S3 upload (Growth/Business plan only).
export async function getUploadUrl(): Promise<{
  upload_url: string;
  file_path: string;
}> {
  const qs = new URLSearchParams({ apiKey: apiKey() });
  const res = await fetch(`${BASE}/api/uploadmedia?${qs}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`OneUp uploadmedia ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as { upload_url: string; file_path: string };
}

function fmtDate(d: Date): string {
  // OneUp expects: YYYY-MM-DD HH:MM
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type CommonPostArgs = {
  categoryId: string;
  socialNetworkIds: string[];
  scheduledAt: Date;
  content: string;
  title?: string;
  subreddit?: string;
  firstComment?: string;
};

function commonFields(args: CommonPostArgs): Record<string, string> {
  const fields: Record<string, string> = {
    category_id: args.categoryId,
    social_network_id: JSON.stringify(args.socialNetworkIds),
    scheduled_date_time: fmtDate(args.scheduledAt),
    content: args.content,
  };
  if (args.title) fields.title = args.title;
  if (args.subreddit) fields.subreddit = args.subreddit;
  if (args.firstComment) fields.first_comment = args.firstComment;
  return fields;
}

export function scheduleImagePost(
  args: CommonPostArgs & { imageUrls: string[] },
): Promise<{ message: string }> {
  return postForm("/api/scheduleimagepost", {
    ...commonFields(args),
    image_url: args.imageUrls.join("~~"),
  });
}

export function scheduleVideoPost(
  args: CommonPostArgs & { videoUrl: string; thumbnailUrl?: string },
): Promise<{ message: string }> {
  const fields: Record<string, string> = {
    ...commonFields(args),
    video_url: args.videoUrl,
  };
  if (args.thumbnailUrl) fields.thumbnail_url = args.thumbnailUrl;
  return postForm("/api/schedulevideopost", fields);
}
