import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

export type ToolAccess = "all" | "pr_only" | "social_only";
export type ToolSection = "pr" | "social";

export function sectionAllowed(
  section: ToolSection,
  access: ToolAccess,
): boolean {
  if (access === "all") return true;
  if (access === "pr_only") return section === "pr";
  if (access === "social_only") return section === "social";
  return true;
}

// Reads the current user's tool_access. Defaults to "all" if not set.
export async function getToolAccess(): Promise<ToolAccess> {
  const session = await requireSession();
  if (!session.userId) return "all";
  const [row] = await db
    .select({ toolAccess: users.toolAccess })
    .from(users)
    .where(eq(users.id, session.userId));
  return (row?.toolAccess as ToolAccess) ?? "all";
}

// Guard for server components / layouts: redirects to /dashboard if the
// current user's tool access doesn't include the given section.
export async function requireSectionAccess(section: ToolSection) {
  const access = await getToolAccess();
  if (!sectionAllowed(section, access)) {
    redirect("/dashboard");
  }
}

// Guard for server actions (defense-in-depth): throws instead of redirecting.
export async function assertSectionAccess(section: ToolSection) {
  const access = await getToolAccess();
  if (!sectionAllowed(section, access)) {
    throw new Error(
      `Forbidden: your account does not have access to ${section === "pr" ? "PR" : "Social Media"} tools.`,
    );
  }
}
