"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { hashPassword } from "@/lib/password";

export type PasswordFormState = { ok?: boolean; error?: string };

export async function setMyPassword(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const session = await requireSession();

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const hash = await hashPassword(password);
  // Use the real (non-impersonated) user id so previewing as someone else
  // can never overwrite their password.
  await db
    .update(users)
    .set({ passwordHash: hash })
    .where(eq(users.id, session.realUserId));

  revalidatePath("/settings");
  return { ok: true };
}
