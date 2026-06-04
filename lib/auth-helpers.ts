import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
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

  return {
    userId: session.user.id!,
    workspaceId: session.user.workspaceId!,
    role,
    actualRole,
    isPreview: role !== actualRole,
    email: session.user.email,
  };
}

export async function requireSessionWithCap(cap: Capability) {
  const session = await requireSession();
  requireCap(session.role, cap);
  return session;
}
