import { auth } from "@/lib/auth";
import { requireCap, type Capability, type Role } from "@/lib/permissions";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    throw new Error("Unauthorized — no workspace");
  }
  return {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
    role: session.user.role as Role,
    email: session.user.email,
  };
}

export async function requireSessionWithCap(cap: Capability) {
  const session = await requireSession();
  requireCap(session.role, cap);
  return session;
}
