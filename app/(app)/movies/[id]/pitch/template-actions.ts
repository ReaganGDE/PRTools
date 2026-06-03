"use server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { pitchTemplates } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

export type PitchTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export async function listPitchTemplates(movieId: string): Promise<PitchTemplate[]> {
  const session = await requireSession();
  return db
    .select({
      id: pitchTemplates.id,
      name: pitchTemplates.name,
      subject: pitchTemplates.subject,
      body: pitchTemplates.body,
    })
    .from(pitchTemplates)
    .where(eq(pitchTemplates.workspaceId, session.workspaceId))
    .orderBy(pitchTemplates.name);
}

export async function savePitchTemplate(
  movieId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (!name || !subject || !body.trim()) return;

  await db.insert(pitchTemplates).values({
    id: nanoid(16),
    workspaceId: session.workspaceId,
    name,
    subject,
    body,
    createdBy: session.userId,
  });
  revalidatePath(`/movies/${movieId}/pitch`);
}

export async function deletePitchTemplate(
  movieId: string,
  templateId: string,
): Promise<void> {
  const session = await requireSession();
  await db
    .delete(pitchTemplates)
    .where(
      and(
        eq(pitchTemplates.id, templateId),
        eq(pitchTemplates.workspaceId, session.workspaceId),
      ),
    );
  revalidatePath(`/movies/${movieId}/pitch`);
}
