"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts, contactLists, contactListMembers } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

const PLATFORMS = [
  "instagram",
  "tiktok",
  "reddit",
  "youtube",
  "facebook",
  "email",
] as const;

const ContactInput = z.object({
  name: z.string().trim().min(1, "Name required"),
  type: z.enum(["influencer", "outlet", "journalist"]),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  primaryPlatform: z.enum(PLATFORMS).optional().or(z.literal("").transform(() => undefined)),
  handleInstagram: z.string().trim().optional(),
  handleTiktok: z.string().trim().optional(),
  handleReddit: z.string().trim().optional(),
  handleYoutube: z.string().trim().optional(),
  outlet: z.string().trim().optional(),
  beat: z.string().trim().optional(),
  followerCount: z
    .union([z.coerce.number().int().nonnegative(), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  tags: z.string().optional().transform((v) =>
    v
      ? v
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
  ),
  notes: z.string().optional(),
});

function fromFormData(fd: FormData) {
  const obj: Record<string, FormDataEntryValue | null> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

export async function createContact(formData: FormData) {
  const session = await requireSession();
  const parsed = ContactInput.safeParse(fromFormData(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;
  const [row] = await db
    .insert(contacts)
    .values({
      workspaceId: session.workspaceId,
      type: data.type,
      name: data.name,
      email: data.email ?? null,
      primaryPlatform: data.primaryPlatform ?? null,
      handleInstagram: data.handleInstagram || null,
      handleTiktok: data.handleTiktok || null,
      handleReddit: data.handleReddit || null,
      handleYoutube: data.handleYoutube || null,
      outlet: data.outlet || null,
      beat: data.beat || null,
      followerCount: data.followerCount,
      tags: data.tags,
      notes: data.notes || null,
      source: "manual",
    })
    .returning({ id: contacts.id });

  revalidatePath("/contacts");
  redirect(`/contacts/${row.id}`);
}

export async function updateContact(id: string, formData: FormData) {
  const session = await requireSession();
  const parsed = ContactInput.safeParse(fromFormData(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;
  await db
    .update(contacts)
    .set({
      type: data.type,
      name: data.name,
      email: data.email ?? null,
      primaryPlatform: data.primaryPlatform ?? null,
      handleInstagram: data.handleInstagram || null,
      handleTiktok: data.handleTiktok || null,
      handleReddit: data.handleReddit || null,
      handleYoutube: data.handleYoutube || null,
      outlet: data.outlet || null,
      beat: data.beat || null,
      followerCount: data.followerCount,
      tags: data.tags,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(contacts.id, id), eq(contacts.workspaceId, session.workspaceId)),
    );
  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
}

export async function deleteContact(id: string) {
  const session = await requireSession();
  await db
    .delete(contacts)
    .where(
      and(eq(contacts.id, id), eq(contacts.workspaceId, session.workspaceId)),
    );
  revalidatePath("/contacts");
  redirect("/contacts");
}

/* ────────────────────── CSV import ────────────────────── */

export type ImportColumnMap = {
  name?: string;
  type?: string;
  email?: string;
  outlet?: string;
  beat?: string;
  followerCount?: string;
  handleInstagram?: string;
  handleTiktok?: string;
  handleReddit?: string;
  handleYoutube?: string;
  tags?: string;
  notes?: string;
};

const CONTACT_TYPES = new Set(["influencer", "outlet", "journalist"]);

function cleanInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export async function importCsv(args: {
  rows: Record<string, string>[];
  map: ImportColumnMap;
  defaultType?: "influencer" | "outlet" | "journalist";
  tagsToApply?: string[];
}) {
  const session = await requireSession();
  const { rows, map, defaultType = "influencer", tagsToApply = [] } = args;

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    const name = map.name ? r[map.name]?.trim() : undefined;
    if (!name) {
      skipped++;
      continue;
    }
    const rawType = map.type ? r[map.type]?.trim().toLowerCase() : undefined;
    const type = (
      rawType && CONTACT_TYPES.has(rawType) ? rawType : defaultType
    ) as "influencer" | "outlet" | "journalist";

    const email = map.email ? r[map.email]?.trim().toLowerCase() : undefined;
    const rowTags = map.tags
      ? r[map.tags]
          ?.split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean) ?? []
      : [];
    const allTags = [...new Set([...rowTags, ...tagsToApply])];

    const values = {
      workspaceId: session.workspaceId,
      type,
      name,
      email: email || null,
      outlet: map.outlet ? r[map.outlet]?.trim() || null : null,
      beat: map.beat ? r[map.beat]?.trim() || null : null,
      followerCount: map.followerCount
        ? cleanInt(r[map.followerCount])
        : null,
      handleInstagram: map.handleInstagram
        ? r[map.handleInstagram]?.trim().replace(/^@/, "") || null
        : null,
      handleTiktok: map.handleTiktok
        ? r[map.handleTiktok]?.trim().replace(/^@/, "") || null
        : null,
      handleReddit: map.handleReddit
        ? r[map.handleReddit]?.trim().replace(/^u\//, "").replace(/^@/, "") ||
          null
        : null,
      handleYoutube: map.handleYoutube
        ? r[map.handleYoutube]?.trim() || null
        : null,
      tags: allTags,
      notes: map.notes ? r[map.notes]?.trim() || null : null,
      source: "csv" as const,
    };

    // Dedup by (workspaceId, email) if email present
    if (email) {
      const existing = await db
        .select({ id: contacts.id, tags: contacts.tags })
        .from(contacts)
        .where(
          and(
            eq(contacts.workspaceId, session.workspaceId),
            eq(contacts.email, email),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        const mergedTags = [
          ...new Set([...(existing[0].tags ?? []), ...allTags]),
        ];
        await db
          .update(contacts)
          .set({
            ...values,
            tags: mergedTags,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, existing[0].id));
        updated++;
        continue;
      }
    }

    await db.insert(contacts).values(values);
    inserted++;
  }

  revalidatePath("/contacts");
  return { ok: true as const, inserted, updated, skipped };
}

/* ────────────────────── Contact lists ────────────────────── */

export async function createList(name: string) {
  const session = await requireSession();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name required" };
  const [row] = await db
    .insert(contactLists)
    .values({ workspaceId: session.workspaceId, name: trimmed })
    .returning({ id: contactLists.id });
  revalidatePath("/contacts");
  return { ok: true as const, id: row.id };
}

export async function addContactToList(contactId: string, listId: string) {
  await requireSession();
  await db
    .insert(contactListMembers)
    .values({ contactId, listId })
    .onConflictDoNothing();
  revalidatePath(`/contacts/${contactId}`);
}

export async function removeContactFromList(
  contactId: string,
  listId: string,
) {
  await requireSession();
  await db
    .delete(contactListMembers)
    .where(
      and(
        eq(contactListMembers.contactId, contactId),
        eq(contactListMembers.listId, listId),
      ),
    );
  revalidatePath(`/contacts/${contactId}`);
}

export async function bulkTag(contactIds: string[], tags: string[]) {
  const session = await requireSession();
  if (contactIds.length === 0 || tags.length === 0) return;
  // Append tags, dedupe in SQL
  for (const id of contactIds) {
    await db
      .update(contacts)
      .set({
        tags: sql`(
          SELECT ARRAY(SELECT DISTINCT UNNEST(${contacts.tags} || ${tags}::text[]))
        )`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(contacts.id, id), eq(contacts.workspaceId, session.workspaceId)),
      );
  }
  revalidatePath("/contacts");
}
