import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireCap, type Capability, type Role, ROLE_RANK } from "@/lib/permissions";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    throw new Error("Unauthorized — no workspace");
  }

  const actualRole = session.user.role as Role;

  // Admins+ can preview the app as a lower-tier role. Read the cookie and apply
  // only if it's a genuine downgrade (viewers can't escalate themselves).
  const jar = await cookies();
  const previewRoleCookie = jar.get("preview_role")?.value as Role | undefined;
  const validRoles: Role[] = ["owner", "admin", "member", "viewer"];
  const isValidPreview =
    !!previewRoleCookie &&
    validRoles.includes(previewRoleCookie) &&
    (ROLE_RANK[actualRole] ?? 0) > (ROLE_RANK[previewRoleCookie] ?? 0);

  const role = isValidPreview ? previewRoleCookie! : actualRole;

  // User impersonation — admins/owners can preview the app as another user.
  const isAdminOrOwner = (ROLE_RANK[actualRole] ?? 0) >= (ROLE_RANK["admin"] ?? 0);
  let effectiveUserId = session.user.id!;
  let isImpersonating = false;
  if (isAdminOrOwner) {
    const previewUserId = jar.get("preview_user_id")?.value;
    if (previewUserId && previewUserId !== session.user.id) {
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, previewUserId),
            eq(users.workspaceId, session.user.workspaceId!),
          ),
        );
      if (target) {
        effectiveUserId = target.id;
        isImpersonating = true;
      }
    }
  }

  return {
    userId: effectiveUserId,
    realUserId: session.user.id!,
    workspaceId: session.user.workspaceId!,
    role,
    actualRole,
    isPreview: role !== actualRole,
    isImpersonating,
    email: session.user.email,
  };
}

export async function requireSessionWithCap(cap: Capability) {
  const session = await requireSession();
  requireCap(session.role, cap);
  return session;
}
