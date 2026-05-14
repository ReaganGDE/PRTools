"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  campaigns,
  contactListMembers,
  contacts,
  sends,
  messageTemplates,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { renderTemplate, listMergeFields } from "@/lib/email/render-template";

const PLATFORM = z.enum(["instagram", "tiktok", "reddit", "youtube"]);

const CampaignInput = z.object({
  name: z.string().trim().min(1),
  platform: PLATFORM,
  listId: z.string().min(1),
  body: z.string().min(1),
  subject: z.string().optional(),
});

export async function createWorkbenchCampaign(formData: FormData) {
  const session = await requireSession();
  const parsed = CampaignInput.parse({
    name: formData.get("name"),
    platform: formData.get("platform"),
    listId: formData.get("listId"),
    body: formData.get("body"),
    subject: formData.get("subject") ?? undefined,
  });

  // Inline ad-hoc template attached to this campaign
  const [tpl] = await db
    .insert(messageTemplates)
    .values({
      workspaceId: session.workspaceId,
      name: `Campaign: ${parsed.name}`,
      channel: "dm",
      platform: parsed.platform,
      subject: parsed.subject || null,
      body: parsed.body,
      mergeFields: listMergeFields(
        `${parsed.subject ?? ""}\n${parsed.body}`,
      ),
    })
    .returning({ id: messageTemplates.id });

  const [row] = await db
    .insert(campaigns)
    .values({
      workspaceId: session.workspaceId,
      name: parsed.name,
      type: "workbench",
      platform: parsed.platform,
      templateId: tpl.id,
      listId: parsed.listId,
      status: "running",
      createdBy: session.userId,
    })
    .returning({ id: campaigns.id });

  revalidatePath("/outreach");
  redirect(`/outreach/${row.id}/workbench`);
}

export type WorkbenchNext = {
  contact: typeof contacts.$inferSelect;
  rendered: string;
  renderedSubject: string | null;
  total: number;
  remaining: number;
  sentCount: number;
} | null;

export async function fetchNext(campaignId: string): Promise<WorkbenchNext> {
  const session = await requireSession();

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.workspaceId, session.workspaceId),
      ),
    );
  if (!campaign || !campaign.listId || !campaign.templateId) return null;

  const [template] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.id, campaign.templateId));
  if (!template) return null;

  // All members
  const members = await db
    .select({ id: contactListMembers.contactId })
    .from(contactListMembers)
    .where(eq(contactListMembers.listId, campaign.listId));
  const total = members.length;

  // Already-sent (or skipped) contact ids for this campaign
  const done = await db
    .select({ contactId: sends.contactId })
    .from(sends)
    .where(eq(sends.campaignId, campaign.id));
  const doneSet = new Set(done.map((d) => d.contactId));

  // Find next contact not yet handled, with a valid handle/email for the platform
  const platformHandleColumn = {
    instagram: contacts.handleInstagram,
    tiktok: contacts.handleTiktok,
    reddit: contacts.handleReddit,
    youtube: contacts.handleYoutube,
  } as const;

  const handleCol =
    campaign.platform && campaign.platform in platformHandleColumn
      ? platformHandleColumn[
          campaign.platform as keyof typeof platformHandleColumn
        ]
      : null;

  const remainingIds = members
    .map((m) => m.id)
    .filter((id) => !doneSet.has(id));

  let nextContact: typeof contacts.$inferSelect | null = null;
  if (remainingIds.length > 0) {
    const candidates = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, session.workspaceId),
          inArray(contacts.id, remainingIds),
          ...(handleCol ? [isNotNull(handleCol)] : []),
        ),
      )
      .limit(1);
    nextContact = candidates[0] ?? null;
  }

  if (!nextContact) return null;

  const renderedBody = renderTemplate(template.body, nextContact).rendered;
  const renderedSubject = template.subject
    ? renderTemplate(template.subject, nextContact).rendered
    : null;

  const sentCount = doneSet.size;
  return {
    contact: nextContact,
    rendered: renderedBody,
    renderedSubject,
    total,
    remaining: total - sentCount - 1,
    sentCount,
  };
}

const MarkInput = z.object({
  campaignId: z.string(),
  contactId: z.string(),
  action: z.enum(["sent", "skipped"]),
  renderedBody: z.string(),
  renderedSubject: z.string().optional(),
});

export async function markOutcome(input: z.infer<typeof MarkInput>) {
  const session = await requireSession();
  const parsed = MarkInput.parse(input);

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, parsed.campaignId),
        eq(campaigns.workspaceId, session.workspaceId),
      ),
    );
  if (!campaign) throw new Error("Campaign not found");

  await db.insert(sends).values({
    workspaceId: session.workspaceId,
    campaignId: campaign.id,
    contactId: parsed.contactId,
    channel: "dm",
    platform: campaign.platform,
    status: parsed.action === "sent" ? "sent" : "skipped",
    renderedBody: parsed.renderedBody,
    renderedSubject: parsed.renderedSubject ?? null,
    sentAt: parsed.action === "sent" ? new Date() : null,
    sentByUserId: session.userId,
  });

  revalidatePath(`/outreach/${campaign.id}/workbench`);
}

export async function completeCampaign(campaignId: string) {
  const session = await requireSession();
  await db
    .update(campaigns)
    .set({ status: "completed", updatedAt: new Date() })
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.workspaceId, session.workspaceId),
      ),
    );
  revalidatePath(`/outreach`);
  redirect("/outreach");
}

