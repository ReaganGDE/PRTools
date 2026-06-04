import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sends, contacts } from "@/lib/db/schema";

export type InboundMatchResult =
  | { matched: true; sendId: string; contactId: string; workspaceId: string }
  | { matched: false; reason: string };

/**
 * Core logic for inbound reply detection. Given the sender's email address (and
 * optionally a campaign id parsed from a reply-to / References header), find the
 * most recent unreplied email send to that contact and mark it replied.
 *
 * This is the automatic counterpart to the manual `markSendReplied` action —
 * both ultimately set `sends.repliedAt`, which lights up the PR Inbox, pitch
 * report reply rate, and drops the contact off the dashboard follow-up list.
 *
 * Matching strategy (most-specific first):
 *  1. If a campaignId is supplied, prefer the send for this contact in that campaign.
 *  2. Otherwise take the most recent unreplied email send to any contact whose
 *     email matches the sender.
 */
export async function recordInboundReply(args: {
  fromEmail: string;
  campaignId?: string | null;
  receivedAt?: Date;
}): Promise<InboundMatchResult> {
  const email = args.fromEmail.trim().toLowerCase();
  if (!email) return { matched: false, reason: "No sender email" };
  const repliedAt = args.receivedAt ?? new Date();

  // Find candidate sends: email channel, to a contact with this email, not yet replied.
  // Join contacts so we match on the contact's address rather than the raw "to".
  const candidates = await db
    .select({
      sendId: sends.id,
      contactId: sends.contactId,
      workspaceId: sends.workspaceId,
      campaignId: sends.campaignId,
      openedAt: sends.openedAt,
      clickedAt: sends.clickedAt,
      sentAt: sends.sentAt,
    })
    .from(sends)
    .innerJoin(contacts, eq(contacts.id, sends.contactId))
    .where(
      and(
        eq(sends.channel, "email"),
        isNull(sends.repliedAt),
        eq(contacts.email, email),
      ),
    )
    .orderBy(desc(sends.sentAt));

  if (candidates.length === 0) {
    return { matched: false, reason: "No matching unreplied send" };
  }

  // Prefer a send within the campaign the reply references, if any.
  const chosen =
    (args.campaignId &&
      candidates.find((c) => c.campaignId === args.campaignId)) ||
    candidates[0];

  await db
    .update(sends)
    .set({ repliedAt, status: "replied" })
    .where(eq(sends.id, chosen.sendId));

  return {
    matched: true,
    sendId: chosen.sendId,
    contactId: chosen.contactId,
    workspaceId: chosen.workspaceId,
  };
}

/**
 * Extracts a campaign id from common header carriers. We stamp outgoing pitch
 * emails with an `X-Campaign-Id` header and a `campaign_id` tag, so a threaded
 * reply often echoes it back via In-Reply-To / References. Best-effort only.
 */
export function parseCampaignIdFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): string | null {
  if (!headers) return null;
  const get = (k: string) => {
    const v = headers[k] ?? headers[k.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const direct = get("X-Campaign-Id") ?? get("x-campaign-id");
  if (direct) return String(direct).trim();
  return null;
}
