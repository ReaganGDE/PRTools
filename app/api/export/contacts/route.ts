import { and, desc, eq, ilike, or, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contacts,
  contactListMembers,
} from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { csvResponse, toCsv } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

const MAX_ROWS = 10_000;

export async function GET(req: Request) {
  const session = await requireSessionWithCap("export.contacts");
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const type = url.searchParams.get("type")?.trim();
  const tag = url.searchParams.get("tag")?.trim();
  const listId = url.searchParams.get("list")?.trim();

  const conds = [eq(contacts.workspaceId, session.workspaceId)];
  if (q) {
    conds.push(
      or(
        ilike(contacts.name, `%${q}%`),
        ilike(contacts.email, `%${q}%`),
        ilike(contacts.outlet, `%${q}%`),
        ilike(contacts.handleInstagram, `%${q}%`),
        ilike(contacts.handleTiktok, `%${q}%`),
        ilike(contacts.handleReddit, `%${q}%`),
        ilike(contacts.handleYoutube, `%${q}%`),
      )!,
    );
  }
  if (type && ["influencer", "outlet", "journalist"].includes(type)) {
    conds.push(
      eq(contacts.type, type as "influencer" | "outlet" | "journalist"),
    );
  }
  if (tag) {
    conds.push(sql`${tag} = ANY(${contacts.tags})`);
  }
  if (listId) {
    const members = await db
      .select({ id: contactListMembers.contactId })
      .from(contactListMembers)
      .where(eq(contactListMembers.listId, listId));
    const ids = members.length > 0 ? members.map((m) => m.id) : ["__never__"];
    conds.push(inArray(contacts.id, ids));
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conds))
    .orderBy(desc(contacts.createdAt))
    .limit(MAX_ROWS);

  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "export.contacts",
    meta: { count: rows.length, q, type, tag, listId },
  });

  const csv = toCsv(rows, [
    { key: "name", header: "Name" },
    { key: "type", header: "Type" },
    { key: "email", header: "Email" },
    { key: "primaryPlatform", header: "Primary platform" },
    { key: "handleInstagram", header: "Instagram" },
    { key: "handleTiktok", header: "TikTok" },
    { key: "handleReddit", header: "Reddit" },
    { key: "handleYoutube", header: "YouTube" },
    { key: "outlet", header: "Outlet" },
    { key: "beat", header: "Beat" },
    { key: "followerCount", header: "Followers" },
    { key: "tags", header: "Tags" },
    { key: "notes", header: "Notes" },
    { key: "unsubscribed", header: "Unsubscribed" },
    { key: "createdAt", header: "Created at" },
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(`contacts-${today}.csv`, csv);
}
