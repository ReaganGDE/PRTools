"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  messageTemplates,
  campaigns,
  contactListMembers,
  contacts,
  sends,
  emailSuppressions,
} from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { assertSectionAccess } from "@/lib/tool-access";
import { logAudit } from "@/lib/audit";
import { resend } from "@/lib/email/resend";
import { renderTemplate, listMergeFields } from "@/lib/email/render-template";
import { unsubscribeFooter } from "@/lib/email/footer";
import { env } from "@/lib/env";

/* ───────────────────── Templates ───────────────────── */

const TemplateInput = z.object({
  name: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  body: z.string().min(1),
});

export async function createTemplate(formData: FormData) {
  const session = await requireSessionWithCap("email.template.create");
  const parsed = TemplateInput.parse({
    name: formData.get("name"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  const [row] = await db
    .insert(messageTemplates)
    .values({
      workspaceId: session.workspaceId,
      name: parsed.name,
      channel: "email",
      subject: parsed.subject,
      body: parsed.body,
      mergeFields: listMergeFields(`${parsed.subject}\n${parsed.body}`),
    })
    .returning({ id: messageTemplates.id });
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "email.template.create",
    targetType: "template",
    targetId: row.id,
    meta: { name: parsed.name },
  });
  revalidatePath("/email");
  redirect(`/email/templates/${row.id}`);
}

export async function updateTemplate(id: string, formData: FormData) {
  const session = await requireSessionWithCap("email.template.edit");
  const parsed = TemplateInput.parse({
    name: formData.get("name"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  await db
    .update(messageTemplates)
    .set({
      name: parsed.name,
      subject: parsed.subject,
      body: parsed.body,
      mergeFields: listMergeFields(`${parsed.subject}\n${parsed.body}`),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(messageTemplates.id, id),
        eq(messageTemplates.workspaceId, session.workspaceId),
      ),
    );
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "email.template.update",
    targetType: "template",
    targetId: id,
    meta: { name: parsed.name },
  });
  revalidatePath(`/email/templates/${id}`);
  revalidatePath("/email");
}

export async function deleteTemplate(id: string) {
  const session = await requireSessionWithCap("email.template.delete");
  await db
    .delete(messageTemplates)
    .where(
      and(
        eq(messageTemplates.id, id),
        eq(messageTemplates.workspaceId, session.workspaceId),
      ),
    );
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "email.template.delete",
    targetType: "template",
    targetId: id,
  });
  revalidatePath("/email");
  redirect("/email");
}

/* ───────────────────── Campaigns ───────────────────── */

const CampaignInput = z.object({
  name: z.string().trim().min(1),
  templateId: z.string().min(1),
  listId: z.string().min(1),
});

export async function createCampaign(formData: FormData) {
  const session = await requireSessionWithCap("email.campaign.create");
  const parsed = CampaignInput.parse({
    name: formData.get("name"),
    templateId: formData.get("templateId"),
    listId: formData.get("listId"),
  });
  const [row] = await db
    .insert(campaigns)
    .values({
      workspaceId: session.workspaceId,
      name: parsed.name,
      type: "email",
      templateId: parsed.templateId,
      listId: parsed.listId,
      createdBy: session.userId,
      status: "draft",
    })
    .returning({ id: campaigns.id });
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "email.campaign.create",
    targetType: "campaign",
    targetId: row.id,
    meta: {
      name: parsed.name,
      templateId: parsed.templateId,
      listId: parsed.listId,
    },
  });
  revalidatePath("/email");
  redirect(`/email/campaigns/${row.id}`);
}

export async function sendCampaign(campaignId: string) {
  const session = await requireSessionWithCap("email.campaign.send");
  await assertSectionAccess("pr");

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.workspaceId, session.workspaceId),
      ),
    );
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.type !== "email") throw new Error("Not an email campaign");
  if (!campaign.templateId || !campaign.listId)
    throw new Error("Campaign missing template or list");
  if (campaign.status === "running" || campaign.status === "completed")
    throw new Error("Campaign already sent");

  const [template] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.id, campaign.templateId));
  if (!template) throw new Error("Template not found");
  if (!template.subject) throw new Error("Template missing subject");

  // Members of the list
  const members = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      contact: contacts,
    })
    .from(contactListMembers)
    .innerJoin(contacts, eq(contacts.id, contactListMembers.contactId))
    .where(eq(contactListMembers.listId, campaign.listId));

  // Suppression list
  const suppressed = await db
    .select({ email: emailSuppressions.email })
    .from(emailSuppressions)
    .where(eq(emailSuppressions.workspaceId, session.workspaceId));
  const suppressedSet = new Set(suppressed.map((s) => s.email.toLowerCase()));

  // Mark campaign running
  await db
    .update(campaigns)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id));

  const client = resend();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of members) {
    if (!m.email) {
      skipped++;
      continue;
    }
    if (suppressedSet.has(m.email.toLowerCase())) {
      skipped++;
      continue;
    }
    if (m.contact.unsubscribed) {
      skipped++;
      continue;
    }

    const subj = renderTemplate(template.subject, m.contact).rendered;
    const bodyHtml = renderTemplate(template.body, m.contact).rendered;
    const footer = await unsubscribeFooter(session.workspaceId, m.email);
    const html = `${bodyHtml}\n${footer}`;

    try {
      const result = await client.emails.send({
        from: env.EMAIL_FROM,
        to: m.email,
        ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
        subject: subj,
        html,
        headers: {
          "X-Campaign-Id": campaign.id,
        },
        tags: [
          { name: "campaign_id", value: campaign.id },
          { name: "workspace_id", value: session.workspaceId },
        ],
      });
      await db.insert(sends).values({
        workspaceId: session.workspaceId,
        campaignId: campaign.id,
        contactId: m.id,
        channel: "email",
        platform: "email",
        status: "sent",
        renderedSubject: subj,
        renderedBody: html,
        sentAt: new Date(),
        externalId: result.data?.id ?? null,
        sentByUserId: session.userId,
      });
      sent++;
    } catch (e) {
      await db.insert(sends).values({
        workspaceId: session.workspaceId,
        campaignId: campaign.id,
        contactId: m.id,
        channel: "email",
        platform: "email",
        status: "failed",
        renderedSubject: subj,
        renderedBody: html,
        error: e instanceof Error ? e.message : String(e),
        sentByUserId: session.userId,
      });
      failed++;
    }
  }

  await db
    .update(campaigns)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id));

  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "email.campaign.send",
    targetType: "campaign",
    targetId: campaign.id,
    meta: { name: campaign.name, sent, skipped, failed },
  });

  revalidatePath(`/email/campaigns/${campaign.id}`);
  revalidatePath("/email");
  return { sent, skipped, failed };
}

/* ───────────────── Suppression / unsubscribe ───────────────── */

export async function suppress(args: {
  workspaceId: string;
  email: string;
  reason: string;
}) {
  await db
    .insert(emailSuppressions)
    .values({
      workspaceId: args.workspaceId,
      email: args.email.toLowerCase(),
      reason: args.reason,
    })
    .onConflictDoNothing();
  // Also mark contact unsubscribed if exists
  await db
    .update(contacts)
    .set({ unsubscribed: true })
    .where(
      and(
        eq(contacts.workspaceId, args.workspaceId),
        eq(contacts.email, args.email.toLowerCase()),
      ),
    );
}

export async function suppressByCampaign(args: {
  workspaceId: string;
  email: string;
  reason: string;
}) {
  await suppress(args);
}

