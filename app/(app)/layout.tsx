import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { Sidebar } from "@/components/sidebar";
import { RolePreviewBanner } from "@/components/role-preview-banner";
import {
  ensureDefaultBrands,
  getActiveBrandId,
  getBrandsForWorkspace,
} from "@/lib/brand-context";
import { ROLE_RANK, type Role } from "@/lib/permissions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!session.user.workspaceId) {
    redirect("/onboarding");
  }

  await ensureDefaultBrands(session.user.workspaceId);
  const [brands, activeBrandId, userRow] = await Promise.all([
    getBrandsForWorkspace(session.user.workspaceId),
    getActiveBrandId(),
    session.user.id
      ? db
          .select({
            role: users.role,
            toolAccess: users.toolAccess,
            isOnboarding: users.isOnboarding,
          })
          .from(users)
          .where(eq(users.id, session.user.id))
          .then((r) => r[0])
      : Promise.resolve(undefined),
  ]);

  // Onboardees get a restricted experience: only the onboarding portal and
  // resources. Enforce it here (a single choke point for all /(app) routes)
  // using the pathname exposed by middleware.
  const isOnboarding = userRow?.isOnboarding ?? false;
  if (isOnboarding) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const allowed = ["/portal", "/resources"];
    const isAllowed = allowed.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (!isAllowed) redirect("/portal");
  }

  // Resolve the effective role (respects role-preview cookie).
  const actualRole = (userRow?.role ?? "member") as Role;
  const jar = await cookies();
  const previewRoleCookie = jar.get("preview_role")?.value as Role | undefined;
  const validRoles: Role[] = ["owner", "admin", "member", "viewer"];
  const isValidPreview =
    !!previewRoleCookie &&
    validRoles.includes(previewRoleCookie) &&
    (ROLE_RANK[actualRole] ?? 0) > (ROLE_RANK[previewRoleCookie] ?? 0);
  const effectiveRole = isValidPreview ? previewRoleCookie! : actualRole;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {isValidPreview && (
        <RolePreviewBanner previewRole={previewRoleCookie!} actualRole={actualRole} />
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          user={{ email: session.user.email, name: session.user.name }}
          role={effectiveRole}
          toolAccess={userRow?.toolAccess ?? "all"}
          isOnboarding={isOnboarding}
          brands={brands.map((b) => ({
            id: b.id,
            name: b.name,
            color: b.color,
            type: b.type,
          }))}
          activeBrandId={activeBrandId}
        />
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
          {children}
        </main>
      </div>
    </div>
  );
}
