"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";
import { createSessionForUser } from "@/lib/session";

export async function changePassword(formData: FormData) {
  const jar = await cookies();
  const userId = jar.get("pending_pw_change_for")?.value;

  if (!userId) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    redirect("/change-password?error=short");
  }
  if (password !== confirm) {
    redirect("/change-password?error=mismatch");
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) redirect("/login");

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: false })
    .where(eq(users.id, userId));

  jar.delete("pending_pw_change_for");
  await createSessionForUser(userId);
  redirect("/dashboard");
}
