"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { onboardingPaperwork, onboardingQuestions, users } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { resend } from "@/lib/email/resend";
import { env } from "@/lib/env";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function submitQuestion(formData: FormData) {
  const session = await requireSessionWithCap("onboarding.view");

  const question = (formData.get("question") as string | null)?.trim();
  if (!question) throw new Error("Question is required");

  const pageContext =
    (formData.get("pageContext") as string | null)?.trim() || null;

  const [inserted] = await db
    .insert(onboardingQuestions)
    .values({
      workspaceId: session.workspaceId,
      userId: session.userId,
      question,
      pageContext,
    })
    .returning();

  // Look up the asker's name/email.
  const [asker] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const askerName = asker?.name || asker?.email || "An onboardee";

  // Find owner/admin recipients in this workspace.
  const recipients = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        eq(users.workspaceId, session.workspaceId),
        inArray(users.role, ["owner", "admin"]),
      ),
    );

  const to = recipients.map((r) => r.email).filter(Boolean);

  // Best-effort email — never throw.
  if (to.length > 0) {
    try {
      const html = `
        <div>
          <p><strong>${escapeHtml(askerName)}</strong> asked a question${
            asker?.email ? ` (${escapeHtml(asker.email)})` : ""
          }:</p>
          <blockquote style="margin:12px 0;padding:12px 16px;border-left:3px solid #d4d4d8;background:#fafafa;white-space:pre-wrap;">${escapeHtml(
            question,
          )}</blockquote>
          ${
            pageContext
              ? `<p style="color:#71717a;font-size:13px;">From: ${escapeHtml(
                  pageContext,
                )}</p>`
              : ""
          }
        </div>
      `;

      await resend().emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: `Onboarding question from ${askerName}`,
        html,
      });

      if (inserted) {
        await db
          .update(onboardingQuestions)
          .set({ emailedAt: new Date() })
          .where(eq(onboardingQuestions.id, inserted.id));
      }
    } catch (err) {
      // Swallow — the question is recorded regardless of email delivery.
      console.error("Failed to email onboarding question", err);
    }
  }

  revalidatePath("/portal");
}

export async function setBringsOnDay1(paperworkId: string, formData: FormData) {
  const session = await requireSessionWithCap("onboarding.view");

  const value = formData.get("bringsOnDay1") === "true";

  const [row] = await db
    .select({ id: onboardingPaperwork.id })
    .from(onboardingPaperwork)
    .where(
      and(
        eq(onboardingPaperwork.id, paperworkId),
        eq(onboardingPaperwork.userId, session.userId),
        eq(onboardingPaperwork.workspaceId, session.workspaceId),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Not found");

  await db
    .update(onboardingPaperwork)
    .set({ bringsOnDay1: value, updatedAt: new Date() })
    .where(eq(onboardingPaperwork.id, paperworkId));

  revalidatePath("/portal");
}

export async function submitPaperwork(paperworkId: string, formData: FormData) {
  const session = await requireSessionWithCap("onboarding.view");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  const [row] = await db
    .select()
    .from(onboardingPaperwork)
    .where(
      and(
        eq(onboardingPaperwork.id, paperworkId),
        eq(onboardingPaperwork.userId, session.userId),
        eq(onboardingPaperwork.workspaceId, session.workspaceId),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Not found");

  const blob = await put(
    `onboarding-paperwork/${paperworkId}-${file.name}`,
    file,
    { access: "public", addRandomSuffix: true },
  );

  await db
    .update(onboardingPaperwork)
    .set({
      submittedFileUrl: blob.url,
      submittedFileName: file.name,
      status: "submitted",
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingPaperwork.id, paperworkId));

  revalidatePath("/portal");
}
