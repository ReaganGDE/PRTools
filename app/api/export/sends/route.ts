import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sends, contacts, campaigns } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { csvResponse, toCsv } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

const MAX_ROWS = 10_000;

export async function GET(req: Request) {
  const session = await requireSessionWithCap("export.sends");
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId")?.trim();

  const conds = [eq(sends.workspaceId, session.workspaceId)];
  if (campaignId) conds.push(eq(sends.campaignId, campaignId));

  const rows = await db
    .select({
      sentAt: sends.sentAt,
      createdAt: sends.createdAt,
      status: sends.status,
      channel: sends.channel,
      platform: sends.platform,
      subject: sends.renderedSubject,
      error: sends.error,
      openedAt: sends.openedAt,
      clickedAt: sends.clickedAt,
      repliedAt: sends.repliedAt,
      campaignName: campaigns.name,
      contactName: contacts.name,
      contactEmail: contacts.email,
    })
    .from(sends)
    .leftJoin(contacts, eq(sends.contactId, contacts.id))
    .leftJoin(campaigns, eq(sends.campaignId, campaigns.id))
    .where(and(...conds))
    .orderBy(desc(sends.createdAt))
    .limit(MAX_ROWS);

  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "export.sends",
    meta: { count: rows.length, campaignId },
  });

  const csv = toCsv(rows, [
    { key: "sentAt", header: "Sent at" },
    { key: "createdAt", header: "Created at" },
    { key: "campaignName", header: "Campaign" },
    { key: "contactName", header: "Contact" },
    { key: "contactEmail", header: "Email" },
    { key: "channel", header: "Channel" },
    { key: "platform", header: "Platform" },
    { key: "status", header: "Status" },
    { key: "subject", header: "Subject" },
    { key: "openedAt", header: "Opened at" },
    { key: "clickedAt", header: "Clicked at" },
    { key: "repliedAt", header: "Replied at" },
    { key: "error", header: "Error" },
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const suffix = campaignId ? `-${campaignId.slice(0, 8)}` : "";
  return csvResponse(`sends${suffix}-${today}.csv`, csv);
}
