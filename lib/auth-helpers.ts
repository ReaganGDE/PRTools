import { auth } from "@/lib/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    throw new Error("Unauthorized — no workspace");
  }
  return {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
    role: session.user.role,
    email: session.user.email,
  };
}
