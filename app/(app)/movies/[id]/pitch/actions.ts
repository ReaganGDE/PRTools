"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  movies,
  contacts,
  campaigns,
  sends,
  movieContacts,
  emailSuppressions,
} from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { assertSectionAccess } from "@/lib/tool-access";
import { logAudit } from "@/lib/audit";
import { resend } from "@/lib/email/resend";
import { renderTemplate } from "@/lib/email/render-template";
import { unsubscribeFooter } from "@/lib/email/footer";
import { env } from "@/lib/env";

// Build the merge-field extras from a film row. These are available in pitch
// subject/body as {{ film_title }}, {{ trailer_url }}, etc.
function filmExtras(m: typeof movies.$inferSelect): Record<string, string> {
  const fmtDate = (d: Date | null) =>
    d
      ? d.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "";
  return {
    film_title: m.title ?? "",
    logline: m.logline ?? "",
    synopsis: m.synopsis ?? "",
    tagline: m.tagline ?? "",
    director: m.director ?? "",
    trailer_url: m.trailerUrl ?? "",
    trailer_password: m.trailerPassword ?? "",
    screener_url: m.screenerUrl ?? "",
    screener_password: m.screenerPassword ?? "",
    website_url: m.websiteUrl ?? "",
    press_kit_url: m.pressKitUrl ?? "",
    release_date: fmtDate(m.releaseDate),
  };
}

export type PitchResult = { sent: number; skipped: number; failed: number };

export async function sendFilmPitch(
  movieId: string,
  formData: FormData,
): Promise<PitchResult> {
  const session = await requireSessionWithCap("email.campaign.send");
  await assertSectionAccess("pr");

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const markScreener = formData.get("markScreener") === "on";
  const contactIds = formData.getAll("contactIds").map(String).filter(Boolean);

  if (!subject) throw new Error("Subject is required");
  if (!body.trim()) throw new Error("Body is required");
  if (contactIds.length === 0) throw new Error("Select at least one recipient");

  const [movie] = await db
    .select()
    .from(movies)
    .where(
      and(eq(movies.id, movieId), eq(movies.workspaceId, session.workspaceId)),
    );
  if (!movie) throw new Error("Movie not found");

  const recipients = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.workspaceId, session.workspaceId),
        inArray(contacts.id, contactIds),
      ),
    );

  const suppressed = await db
    .select({ email: emailSuppressions.email })
    .from(emailSuppressions)
    .where(eq(emailSuppressions.workspaceId, session.workspaceId));
  const suppressedSet = new Set(suppressed.map((s) => s.email.toLowerCase()));

  // Group these sends under a campaign for history/reporting.
  const [campaign] = await db
    .insert(campaigns)
    .values({
      workspaceId: session.workspaceId,
      name: `Pitch: ${movie.title}`,
      type: "email",
      movieId,
      createdBy: session.userId,
      status: "running",
    })
    .returning({ id: campaigns.id });

  const extras = filmExtras(movie);
  const client = resend();
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const sentContactIds: string[] = [];

  for (const c of recipients) {
    if (!c.email || suppressedSet.has(c.email.toLowerCase()) || c.unsubscribed) {
      skipped++;
      continue;
    }
    const subj = renderTemplate(subject, c, extras).rendered;
    const bodyHtml = renderTemplate(body, c, extras).rendered;
    const footer = await unsubscribeFooter(session.workspaceId, c.email);
    const html = `${bodyHtml}\n${footer}`;

    try {
      const result = await client.emails.send({
        from: env.EMAIL_FROM,
        to: c.email,
        subject: subj,
        html,
        headers: { "X-Campaign-Id": campaign.id },
        tags: [
          { name: "campaign_id", value: campaign.id },
          { name: "workspace_id", value: session.workspaceId },
        ],
      });
      await db.insert(sends).values({
        workspaceId: session.workspaceId,
        campaignId: campaign.id,
        contactId: c.id,
        channel: "email",
        platform: "email",
        status: "sent",
        renderedSubject: subj,
        renderedBody: html,
        sentAt: new Date(),
        externalId: result.data?.id ?? null,
        sentByUserId: session.userId,
      });
      sentContactIds.push(c.id);
      sent++;
    } catch (e) {
      await db.insert(sends).values({
        workspaceId: session.workspaceId,
        campaignId: campaign.id,
        contactId: c.id,
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

  // Optionally stamp screener-sent on the movie↔contact links for recipients.
  if (markScreener && sentContactIds.length > 0) {
    await db
      .update(movieContacts)
      .set({ screenerSentAt: new Date() })
      .where(
        and(
          eq(movieContacts.workspaceId, session.workspaceId),
          eq(movieContacts.movieId, movieId),
          inArray(movieContacts.contactId, sentContactIds),
        ),
      );
  }

  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "email.campaign.send",
    targetType: "campaign",
    targetId: campaign.id,
    meta: { name: `Pitch: ${movie.title}`, movieId, sent, skipped, failed },
  });

  revalidatePath(`/movies/${movieId}`);
  return { sent, skipped, failed };
}
