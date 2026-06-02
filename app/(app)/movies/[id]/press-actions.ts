"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { movieContacts } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

export async function addMovieContact(movieId: string, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "").trim();
  if (!contactId) return;
  await db
    .insert(movieContacts)
    .values({
      id: nanoid(16),
      workspaceId: session.workspaceId,
      movieId,
      contactId,
    })
    .onConflictDoNothing();
  revalidatePath(`/movies/${movieId}`);
}

export async function removeMovieContact(movieId: string, contactId: string) {
  const session = await requireSession();
  await db
    .delete(movieContacts)
    .where(
      and(
        eq(movieContacts.workspaceId, session.workspaceId),
        eq(movieContacts.movieId, movieId),
        eq(movieContacts.contactId, contactId),
      ),
    );
  revalidatePath(`/movies/${movieId}`);
}

export async function toggleScreenerSent(movieId: string, contactId: string) {
  const session = await requireSession();
  const [row] = await db
    .select({ screenerSentAt: movieContacts.screenerSentAt })
    .from(movieContacts)
    .where(
      and(
        eq(movieContacts.workspaceId, session.workspaceId),
        eq(movieContacts.movieId, movieId),
        eq(movieContacts.contactId, contactId),
      ),
    );
  if (!row) return;
  await db
    .update(movieContacts)
    .set({ screenerSentAt: row.screenerSentAt ? null : new Date() })
    .where(
      and(
        eq(movieContacts.workspaceId, session.workspaceId),
        eq(movieContacts.movieId, movieId),
        eq(movieContacts.contactId, contactId),
      ),
    );
  revalidatePath(`/movies/${movieId}`);
  revalidatePath(`/contacts/${contactId}`);
}
