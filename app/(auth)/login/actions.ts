"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/password";
import { createSessionForUser } from "@/lib/session";

export async function loginWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "") || "/dashboard";

  const fail = () =>
    redirect(
      `/login?error=CredentialsSignin&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );

  if (!email || !password) fail();

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    fail();
  }

  await createSessionForUser(user!.id);
  redirect(callbackUrl);
}
