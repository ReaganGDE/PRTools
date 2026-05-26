// Minimal Airtable REST client. We only need read access for the sync.
// PAT goes in Authorization: Bearer header.

const API = "https://api.airtable.com/v0";

export type AirtableAttachment = {
  id: string;
  url: string;
  filename: string;
  type?: string;
  width?: number;
  height?: number;
  thumbnails?: {
    small?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
    full?: { url: string; width: number; height: number };
  };
};

export type AirtableRecord = {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
};

export type AirtableListResponse = {
  records: AirtableRecord[];
  offset?: string;
};

export type AirtableTable = {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: { id: string; name: string; type: string }[];
};

async function fetchJson<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Airtable ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// List bases the PAT has access to.
export async function listBases(token: string): Promise<{ id: string; name: string }[]> {
  const data = await fetchJson<{ bases: { id: string; name: string }[] }>(
    `${API}/meta/bases`,
    token,
  );
  return data.bases;
}

// List tables in a base. Returns table schema (id, name, fields).
export async function listTables(token: string, baseId: string): Promise<AirtableTable[]> {
  const data = await fetchJson<{ tables: AirtableTable[] }>(
    `${API}/meta/bases/${baseId}/tables`,
    token,
  );
  return data.tables;
}

// Fetch all records from a table, paginating until done.
export async function fetchAllRecords(
  token: string,
  baseId: string,
  tableId: string,
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${API}/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const data = await fetchJson<AirtableListResponse>(url.toString(), token);
    all.push(...data.records);
    offset = data.offset;
  } while (offset);
  return all;
}

// Pick a poster from attachments. Prefer portrait orientation (height > width).
// Falls back to the last attachment in the list, then the first.
export function pickPosterUrl(
  attachments: AirtableAttachment[] | undefined,
): string | null {
  if (!attachments || attachments.length === 0) return null;
  const portrait = attachments.find(
    (a) => a.width && a.height && a.height > a.width,
  );
  if (portrait) return portrait.url;
  return attachments[attachments.length - 1]?.url ?? attachments[0]?.url ?? null;
}

// Helpers to safely read field values regardless of whether the Airtable
// field returns a string, array, attachment list, or select object.

export function readString(fields: Record<string, unknown>, name: string): string | null {
  const v = fields[name];
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return (v[0] as string).trim() || null;
  return null;
}

export function readDate(fields: Record<string, unknown>, name: string): Date | null {
  const v = fields[name];
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function readAttachments(
  fields: Record<string, unknown>,
  name: string,
): AirtableAttachment[] | undefined {
  const v = fields[name];
  return Array.isArray(v) ? (v as AirtableAttachment[]) : undefined;
}
