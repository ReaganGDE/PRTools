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

export type FollowUpResult = { sent: boolean; error?: string };

const DEFAULT_SUBJECT = "Following up — {{film_title}}";
const DEFAULT_BODY = `Hi {{first_name}},

Just circling back on {{film_title}} — I wanted to make sure the screener reached you and see if you'd be interested in covering it.

Happy to resend the link or answer any questions. The screener is here:
{{screener_url}}

Thanks so much,`;

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
 * Sends a one-click follow-up reminder email to a contact who received a
 * screener but hasn't replied. Uses a sensible default template rendered with
 * the film's merge fields. Logs a campaign + send row so it shows in history
 * and (once replied) drops off the dashboard follow-up list.
 */
export async function sendFollowUpReminder(
  movieId: string,
  contactId: string,
): Promise<FollowUpResult> {
  const session = await requireSessionWithCap("email.campaign.send");

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

  // Respect suppression list.
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
  const subject = renderTemplate(DEFAULT_SUBJECT, contact, extras).rendered;
  const body = renderTemplate(DEFAULT_BODY, contact, extras).rendered;
  const footer = await unsubscribeFooter(session.workspaceId, contact.email);
  const html = `${body.replace(/\n/g, "<br>")}\n${footer}`;

  const [campaign] = await db
    .insert(campaigns)
    .values({
      workspaceId: session.workspaceId,
      name: `Follow-up: ${movie.title}`,
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

  revalidatePath("/dashboard");
  return { sent: true };
}
