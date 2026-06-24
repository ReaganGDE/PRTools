"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  onboardingPaperwork,
  onboardingLearnings,
} from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";

function revalidate() {
  revalidatePath("/settings/onboarding");
  revalidatePath("/portal");
}

// ─── People ───────────────────────────────────────────────────────────────────

export async function setUserOnboarding(userId: string, formData: FormData) {
  const session = await requireSessionWithCap("onboarding.admin");

  // Support either a checkbox (name="enabled" → "on") or an explicit string value.
  const value = formData.get("value");
  const enabled =
    value != null ? String(value) === "1" : formData.get("enabled") === "on";

  await db
    .update(users)
    .set({ isOnboarding: enabled })
    .where(and(eq(users.id, userId), eq(users.workspaceId, session.workspaceId)));

  revalidate();
}

// ─── Paperwork ──────────────────────────────────────────────────────────────────

export async function createPaperwork(formData: FormData) {
  const session = await requireSessionWithCap("onboarding.admin");

  const userId = String(formData.get("userId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const templateUrl = (formData.get("templateUrl") as string | null)?.trim() || null;

  if (!userId) throw new Error("An onboardee is required");
  if (!title) throw new Error("Paperwork title is required");

  await db.insert(onboardingPaperwork).values({
    workspaceId: session.workspaceId,
    userId,
    title,
    description,
    templateUrl,
    status: "pending",
    createdBy: session.userId,
  });

  revalidate();
}

export async function deletePaperwork(paperworkId: string, _formData: FormData) {
  const session = await requireSessionWithCap("onboarding.admin");

  await db
    .delete(onboardingPaperwork)
    .where(
      and(
        eq(onboardingPaperwork.id, paperworkId),
        eq(onboardingPaperwork.workspaceId, session.workspaceId),
      ),
    );

  revalidate();
}

export async function approvePaperwork(paperworkId: string, _formData: FormData) {
  const session = await requireSessionWithCap("onboarding.admin");

  await db
    .update(onboardingPaperwork)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(onboardingPaperwork.id, paperworkId),
        eq(onboardingPaperwork.workspaceId, session.workspaceId),
      ),
    );

  revalidate();
}

// ─── Learnings ──────────────────────────────────────────────────────────────────

export async function createLearning(formData: FormData) {
  const session = await requireSessionWithCap("onboarding.admin");

  const title = String(formData.get("title") ?? "").trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const type = String(formData.get("type") ?? "link") as "link" | "text";
  const url = (formData.get("url") as string | null)?.trim() || null;
  const body = (formData.get("body") as string | null)?.trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;

  if (!title) throw new Error("Learning title is required");

  await db.insert(onboardingLearnings).values({
    workspaceId: session.workspaceId,
    title,
    description,
    type,
    url,
    body,
    sortOrder,
    createdBy: session.userId,
  });

  revalidate();
}

export async function updateLearning(learningId: string, formData: FormData) {
  const session = await requireSessionWithCap("onboarding.admin");

  const title = String(formData.get("title") ?? "").trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const type = String(formData.get("type") ?? "link") as "link" | "text";
  const url = (formData.get("url") as string | null)?.trim() || null;
  const body = (formData.get("body") as string | null)?.trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;

  if (!title) throw new Error("Learning title is required");

  await db
    .update(onboardingLearnings)
    .set({ title, description, type, url, body, sortOrder, updatedAt: new Date() })
    .where(
      and(
        eq(onboardingLearnings.id, learningId),
        eq(onboardingLearnings.workspaceId, session.workspaceId),
      ),
    );

  revalidate();
}

export async function deleteLearning(learningId: string, _formData: FormData) {
  const session = await requireSessionWithCap("onboarding.admin");

  await db
    .delete(onboardingLearnings)
    .where(
      and(
        eq(onboardingLearnings.id, learningId),
        eq(onboardingLearnings.workspaceId, session.workspaceId),
      ),
    );

  revalidate();
}

// ─── Test users ─────────────────────────────────────────────────────────────

export async function createTestUser(formData: FormData) {
  const session = await requireSessionWithCap("onboarding.admin");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = (formData.get("name") as string | null)?.trim() || null;

  if (!email) throw new Error("Email is required");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (existing.length > 0) throw new Error("A user with that email already exists");

  await db.insert(users).values({
    email,
    name,
    workspaceId: session.workspaceId,
    role: "member",
    isOnboarding: true,
  });

  revalidate();
}

// ─── Impersonation ──────────────────────────────────────────────────────────

export async function startImpersonation(userId: string, _formData: FormData) {
  const session = await requireSessionWithCap("onboarding.admin");

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.workspaceId, session.workspaceId)));

  if (!target) throw new Error("User not found");

  const jar = await cookies();
  jar.set("preview_user_id", userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60,
  });

  redirect("/portal");
}

export async function stopImpersonation(_formData?: FormData) {
  const jar = await cookies();
  jar.delete("preview_user_id");
  redirect("/settings/onboarding");
}
