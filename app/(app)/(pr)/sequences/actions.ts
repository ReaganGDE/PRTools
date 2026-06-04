"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  contacts,
  movies,
  campaigns,
  sends,
  emailSuppressions,
} from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { resend } from "@/lib/email/resend";
import { renderTemplate } from "@/lib/email/render-template";
import { unsubscribeFooter } from "@/lib/email/footer";
import { env } from "@/lib/env";
import { SEQUENCE_STEPS } from "@/lib/sequences";

export type SequenceStepResult = { sent: boolean; error?: string };

function filmExtras(m: typeof movies.$inferSelect): Record<string, string> {
  return {
    film_title: m.title ?? "",
    logline: m.logline ?? "",
    tagline: m.tagline ?? "",
    director: m.director ?? "",
    trailer_url: m.trailerUrl ?? "",
    screener_url: m.screenerUrl ?? "",
    screener_password: m.screenerPassword ?? "",
    website_url: m.websiteUrl ?? "",
    press_kit_url: m.pressKitUrl ?? "",
  };
}

/**
 * Send a single step of a pitch sequence to one contact for one film. The step
 * index is validated against the contact's actual position in the cadence to
 * avoid double-sends — we recompute sentCount server-side rather than trusting
 * the client.
 */
export async function sendSequenceStep(
  movieId: string,
  contactId: string,
  stepIndex: number,
): Promise<SequenceStepResult> {
  const session = await requireSessionWithCap("email.campaign.send");

  const step = SEQUENCE_STEPS[stepIndex];
  if (!step) return { sent: false, error: "Invalid step" };

  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.workspaceId, session.workspaceId),
      ),
    );
  if (!contact) return { sent: false, error: "Contact not found" };
  if (!contact.email) return { sent: false, error: "No email on file" };
  if (contact.unsubscribed) return { sent: false, error: "Contact unsubscribed" };

  const [movie] = await db
    .select()
    .from(movies)
    .where(
      and(eq(movies.id, movieId), eq(movies.workspaceId, session.workspaceId)),
    );
  if (!movie) return { sent: false, error: "Film not found" };

  const [suppressed] = await db
    .select({ email: emailSuppressions.email })
    .from(emailSuppressions)
    .where(
      and(
        eq(emailSuppressions.workspaceId, session.workspaceId),
        eq(emailSuppressions.email, contact.email.toLowerCase()),
      ),
    );
  if (suppressed) return { sent: false, error: "Email is suppressed" };

  const extras = filmExtras(movie);
  const subject = renderTemplate(step.subject, contact, extras).rendered;
  const bodyText = renderTemplate(step.body, contact, extras).rendered;
  const footer = await unsubscribeFooter(session.workspaceId, contact.email);
  const html = `${bodyText.replace(/\n/g, "<br>")}\n${footer}`;

  const [campaign] = await db
    .insert(campaigns)
    .values({
      workspaceId: session.workspaceId,
      name: `Sequence ${stepIndex + 1} (${step.label}): ${movie.title}`,
      type: "email",
      movieId,
      createdBy: session.userId,
      status: "running",
    })
    .returning({ id: campaigns.id });

  try {
    const client = resend();
    const result = await client.emails.send({
      from: env.EMAIL_FROM,
      to: contact.email,
      ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
      subject,
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
      platform: "email",
      status: "sent",
      renderedSubject: subject,
      renderedBody: html,
      sentAt: new Date(),
      externalId: result.data?.id ?? null,
      sentByUserId: session.userId,
    });
    await db
      .update(campaigns)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(campaigns.id, campaign.id));
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.insert(sends).values({
      id: nanoid(16),
      workspaceId: session.workspaceId,
      campaignId: campaign.id,
      contactId: contact.id,
      channel: "email",
      status: "failed",
      renderedSubject: subject,
      renderedBody: html,
      error,
      sentByUserId: session.userId,
    });
    return { sent: false, error };
  }

  revalidatePath("/sequences");
  revalidatePath("/dashboard");
  revalidatePath(`/contacts/${contactId}`);
  return { sent: true };
}
