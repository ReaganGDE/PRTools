"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { ROLE_RANK, type Role } from "@/lib/permissions";

export async function updateFollowUpDays(days: number): Promise<void> {
  const session = await requireSession();
  const n = Math.max(1, Math.min(30, Math.round(days)));
  await db
    .update(workspaces)
    .set({ followUpDays: n })
    .where(eq(workspaces.id, session.workspaceId));
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function setPreviewRole(previewRole: string): Promise<void> {
  const session = await requireSession();
  const validRoles: Role[] = ["admin", "member", "viewer"];
  if (
    !validRoles.includes(previewRole as Role) ||
    (ROLE_RANK[session.actualRole] ?? 0) <= (ROLE_RANK[previewRole as Role] ?? 0)
  ) {
    throw new Error("Invalid preview role");
  }
  const jar = await cookies();
  jar.set("preview_role", previewRole, { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}

export async function clearPreviewRole(): Promise<void> {
  const jar = await cookies();
  jar.delete("preview_role");
  revalidatePath("/", "layout");
}
