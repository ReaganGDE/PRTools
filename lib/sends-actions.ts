"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sends } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";

export type MarkRepliedResult = { ok: boolean; replied: boolean };

/**
 * Manually mark (or unmark) an email send as replied. This is the source of
 * truth for reply tracking — Resend has no inbound "reply" webhook, so replies
 * are recorded here. Setting repliedAt lights up the PR Inbox, the pitch
 * report reply rate, and drops the contact off the dashboard follow-up list.
 */
export async function markSendReplied(
  sendId: string,
  replied: boolean,
): Promise<MarkRepliedResult> {
  const session = await requireSessionWithCap("contacts.edit");

  const [row] = await db
    .select({
      id: sends.id,
      openedAt: sends.openedAt,
      clickedAt: sends.clickedAt,
    })
    .from(sends)
    .where(
      and(eq(sends.id, sendId), eq(sends.workspaceId, session.workspaceId)),
    );
  if (!row) return { ok: false, replied: false };

  if (replied) {
    await db
      .update(sends)
      .set({ repliedAt: new Date(), status: "replied" })
      .where(
        and(eq(sends.id, sendId), eq(sends.workspaceId, session.workspaceId)),
      );
  } else {
    // Revert status to the best prior signal we have.
    const revertStatus = row.clickedAt
      ? "clicked"
      : row.openedAt
        ? "opened"
        : "sent";
    await db
      .update(sends)
      .set({ repliedAt: null, status: revertStatus })
      .where(
        and(eq(sends.id, sendId), eq(sends.workspaceId, session.workspaceId)),
      );
  }

  revalidatePath("/inbox");
  revalidatePath("/pitch-report");
  revalidatePath("/dashboard");
  revalidatePath("/contacts");
  return { ok: true, replied };
}
