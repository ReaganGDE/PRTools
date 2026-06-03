"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { contacts, movies, sends, campaigns, emailSuppressions } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { assertSectionAccess } from "@/lib/tool-access";
import { resend } from "@/lib/email/resend";
import { renderTemplate } from "@/lib/email/render-template";
import { unsubscribeFooter } from "@/lib/email/footer";
import { env } from "@/lib/env";

export type PitchInfluencerResult = {
  sent: boolean;
  channel: "email" | "dm";
  error?: string;
};

export async function sendInfluencerPitch(
  contactId: string,
  formData: FormData,
): Promise<PitchInfluencerResult> {
  const session = await requireSessionWithCap("email.campaign.send");
  await assertSectionAccess("social");

  const movieId = String(formData.get("movieId") ?? "").trim() || null;
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const channel = (String(formData.get("channel") ?? "email")) as "email" | "dm";

  if (!body) return { sent: false, channel, error: "Message body is required" };

  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.workspaceId, session.workspaceId),
      ),
    );
  if (!contact) return { sent: false, channel, error: "Contact not found" };

  let movie: typeof movies.$inferSelect | undefined;
  if (movieId) {
    const [m] = await db
      .select()
      .from(movies)
      .where(
        and(
          eq(movies.id, movieId),
          eq(movies.workspaceId, session.workspaceId),
        ),
      );
    movie = m;
  }

  // Extra merge fields beyond the contact fields
  const extra: Record<string, string> = {
    ...(movie
      ? {
          film_title: movie.title ?? "",
          logline: movie.logline ?? "",
          trailer_url: movie.trailerUrl ?? "",
          screener_url: movie.screenerUrl ?? "",
          screener_password: movie.screenerPassword ?? "",
          press_kit_url: movie.pressKitUrl ?? "",
          website_url: movie.websiteUrl ?? "",
        }
      : {}),
  };

  const renderedSubject = renderTemplate(subject, contact, extra).rendered;
  const renderedBody = renderTemplate(body, contact, extra).rendered;

  // Group under a lightweight campaign for history
  const [campaign] = await db
    .insert(campaigns)
    .values({
      workspaceId: session.workspaceId,
      name: `Influencer pitch: ${contact.name}`,
      type: "email",
      movieId: movieId ?? undefined,
      createdBy: session.userId,
      status: "running",
    })
    .returning({ id: campaigns.id });

  // Email path
  if (channel === "email" && contact.email) {
    const suppressed = await db
      .select({ email: emailSuppressions.email })
      .from(emailSuppressions)
      .where(eq(emailSuppressions.workspaceId, session.workspaceId));
    const suppressedSet = new Set(suppressed.map((s) => s.email.toLowerCase()));

    if (suppressedSet.has(contact.email.toLowerCase()) || contact.unsubscribed) {
      await db.insert(sends).values({
        id: nanoid(16),
        workspaceId: session.workspaceId,
        campaignId: campaign.id,
        contactId: contact.id,
        channel: "email",
        status: "skipped",
        renderedSubject,
        renderedBody,
        sentByUserId: session.userId,
      });
      await db.update(campaigns).set({ status: "completed" }).where(eq(campaigns.id, campaign.id));
      return { sent: false, channel, error: "Contact is unsubscribed or suppressed" };
    }

    try {
      const footer = await unsubscribeFooter(session.workspaceId, contact.email);
      const html = `${renderedBody}\n${footer}`;
      const client = resend();
      const result = await client.emails.send({
        from: env.EMAIL_FROM,
        to: contact.email,
        subject: renderedSubject,
        html,
        headers: { "X-Campaign-Id": campaign.id },
        tags: [
          { name: "campaign_id", value: campaign.id },
          { name: "workspace_id", value: session.workspaceId },
        ],
      });
      await db.insert(sends).values({
        id: nanoid(16),
        workspaceId: session.workspaceId,
        campaignId: campaign.id,
        contactId: contact.id,
        channel: "email",
        status: "sent",
        renderedSubject,
        renderedBody: html,
        sentAt: new Date(),
        externalId: result.data?.id ?? null,
        sentByUserId: session.userId,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await db.insert(sends).values({
        id: nanoid(16),
        workspaceId: session.workspaceId,
        campaignId: campaign.id,
        contactId: contact.id,
        channel: "email",
        status: "failed",
        renderedSubject,
        renderedBody,
        error: errMsg,
        sentByUserId: session.userId,
      });
      await db.update(campaigns).set({ status: "completed" }).where(eq(campaigns.id, campaign.id));
      return { sent: false, channel, error: errMsg };
    }
  } else {
    // DM / manual — record it as sent so it shows in contact history
    await db.insert(sends).values({
      id: nanoid(16),
      workspaceId: session.workspaceId,
      campaignId: campaign.id,
      contactId: contact.id,
      channel: "dm",
      status: "sent",
      renderedSubject,
      renderedBody,
      sentAt: new Date(),
      sentByUserId: session.userId,
    });
  }

  await db.update(campaigns).set({ status: "completed" }).where(eq(campaigns.id, campaign.id));
  revalidatePath(`/contacts/${contactId}`);
  return { sent: true, channel };
}
