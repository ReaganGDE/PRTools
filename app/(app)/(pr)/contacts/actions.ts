"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts, contactLists, contactListMembers } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

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
  const session = await requireSessionWithCap("contacts.create");
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

  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "contact.create",
    targetType: "contact",
    targetId: row.id,
    meta: { name: data.name, type: data.type },
  });

  revalidatePath("/contacts");
  redirect(`/contacts/${row.id}`);
}

export async function updateContact(id: string, formData: FormData) {
  const session = await requireSessionWithCap("contacts.edit");
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
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "contact.update",
    targetType: "contact",
    targetId: id,
    meta: { name: data.name },
  });
  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
}

export async function deleteContact(id: string) {
  const session = await requireSessionWithCap("contacts.delete");
  const [existing] = await db
    .select({ name: contacts.name })
    .from(contacts)
    .where(
      and(eq(contacts.id, id), eq(contacts.workspaceId, session.workspaceId)),
    );
  await db
    .delete(contacts)
    .where(
      and(eq(contacts.id, id), eq(contacts.workspaceId, session.workspaceId)),
    );
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "contact.delete",
    targetType: "contact",
    targetId: id,
    meta: existing ? { name: existing.name } : undefined,
  });
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
  const session = await requireSessionWithCap("contacts.import");
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

  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "contact.import",
    targetType: "contact",
    meta: { inserted, updated, skipped, defaultType, tagsToApply },
  });

  revalidatePath("/contacts");
  return { ok: true as const, inserted, updated, skipped };
}

/* ────────────────────── Contact lists ────────────────────── */

export async function createList(name: string, description?: string) {
  const session = await requireSessionWithCap("lists.create");
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name required" };
  const [row] = await db
    .insert(contactLists)
    .values({
      workspaceId: session.workspaceId,
      name: trimmed,
      description: description?.trim() || null,
    })
    .returning({ id: contactLists.id });
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "list.create",
    targetType: "list",
    targetId: row.id,
    meta: { name: trimmed },
  });
  revalidatePath("/contacts");
  revalidatePath("/contacts/lists");
  return { ok: true as const, id: row.id };
}

// Verify list belongs to the caller's workspace before mutating membership.
async function assertListOwned(listId: string, workspaceId: string) {
  const [row] = await db
    .select({ id: contactLists.id })
    .from(contactLists)
    .where(
      and(eq(contactLists.id, listId), eq(contactLists.workspaceId, workspaceId)),
    );
  if (!row) throw new Error("List not found");
}

export async function addContactsToList(
  listId: string,
  contactIds: string[],
): Promise<{ added: number; skipped: number }> {
  const session = await requireSessionWithCap("lists.edit");
  if (contactIds.length === 0) return { added: 0, skipped: 0 };
  await assertListOwned(listId, session.workspaceId);

  // Filter to contacts in this workspace so we never insert cross-workspace.
  const owned = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        inArray(contacts.id, contactIds),
        eq(contacts.workspaceId, session.workspaceId),
      ),
    );
  if (owned.length === 0) return { added: 0, skipped: contactIds.length };

  // ON CONFLICT DO NOTHING so re-adding existing members doesn't error.
  const inserted = await db
    .insert(contactListMembers)
    .values(owned.map((c) => ({ listId, contactId: c.id })))
    .onConflictDoNothing()
    .returning({ contactId: contactListMembers.contactId });

  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "list.create",
    targetType: "list",
    targetId: listId,
    meta: { added: inserted.length, requested: contactIds.length },
  });

  revalidatePath("/contacts");
  revalidatePath("/contacts/lists");
  revalidatePath(`/contacts/lists/${listId}`);
  for (const c of owned) revalidatePath(`/contacts/${c.id}`);

  return { added: inserted.length, skipped: contactIds.length - inserted.length };
}

export async function removeContactFromList(listId: string, contactId: string) {
  const session = await requireSessionWithCap("lists.edit");
  await assertListOwned(listId, session.workspaceId);
  await db
    .delete(contactListMembers)
    .where(
      and(
        eq(contactListMembers.listId, listId),
        eq(contactListMembers.contactId, contactId),
      ),
    );
  revalidatePath("/contacts");
  revalidatePath("/contacts/lists");
  revalidatePath(`/contacts/lists/${listId}`);
  revalidatePath(`/contacts/${contactId}`);
}

export async function renameList(listId: string, name: string, description?: string) {
  const session = await requireSessionWithCap("lists.edit");
  await assertListOwned(listId, session.workspaceId);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");
  await db
    .update(contactLists)
    .set({ name: trimmed, description: description?.trim() || null })
    .where(eq(contactLists.id, listId));
  revalidatePath("/contacts/lists");
  revalidatePath(`/contacts/lists/${listId}`);
}

export async function deleteList(listId: string) {
  const session = await requireSessionWithCap("lists.edit");
  await assertListOwned(listId, session.workspaceId);
  // Cascade deletes members via FK
  await db.delete(contactLists).where(eq(contactLists.id, listId));
  revalidatePath("/contacts");
  revalidatePath("/contacts/lists");
}

export async function bulkTag(contactIds: string[], tags: string[]) {
  const session = await requireSessionWithCap("contacts.edit");
  if (contactIds.length === 0 || tags.length === 0) return;
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "contact.bulk_tag",
    meta: { contactCount: contactIds.length, tags },
  });
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
