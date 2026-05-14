import type { Contact } from "@/lib/db/schema";

const MERGE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

const FIELD_MAP: Record<string, (c: Contact) => string | null | undefined> = {
  first_name: (c) => c.name?.split(/\s+/)[0] ?? null,
  name: (c) => c.name,
  email: (c) => c.email,
  outlet: (c) => c.outlet,
  beat: (c) => c.beat,
  instagram: (c) => c.handleInstagram,
  tiktok: (c) => c.handleTiktok,
  reddit: (c) => c.handleReddit,
  youtube: (c) => c.handleYoutube,
};

export function listMergeFields(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(MERGE_RE)) {
    found.add(m[1]);
  }
  return [...found];
}

export function renderTemplate(
  body: string,
  contact: Contact,
  extra: Record<string, string> = {},
): { rendered: string; missing: string[] } {
  const missing: string[] = [];
  const rendered = body.replace(MERGE_RE, (_, key: string) => {
    if (key in extra) return extra[key] ?? "";
    const fn = FIELD_MAP[key];
    if (fn) {
      const v = fn(contact);
      if (v == null || v === "") {
        missing.push(key);
        return "";
      }
      return v;
    }
    missing.push(key);
    return "";
  });
  return { rendered, missing };
}

export const AVAILABLE_MERGE_FIELDS = Object.keys(FIELD_MAP);
