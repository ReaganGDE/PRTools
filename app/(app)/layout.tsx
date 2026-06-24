import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { Sidebar } from "@/components/sidebar";
import { RolePreviewBanner } from "@/components/role-preview-banner";
import { ImpersonationBanner } from "@/components/impersonation-banner";
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
  const jar = await cookies();

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

  // Resolve the effective role (respects role-preview cookie).
  const actualRole = (userRow?.role ?? "member") as Role;
  const previewRoleCookie = jar.get("preview_role")?.value as Role | undefined;
  const validRoles: Role[] = ["owner", "admin", "member", "viewer"];
  const isValidPreview =
    !!previewRoleCookie &&
    validRoles.includes(previewRoleCookie) &&
    (ROLE_RANK[actualRole] ?? 0) > (ROLE_RANK[previewRoleCookie] ?? 0);
  const effectiveRole = isValidPreview ? previewRoleCookie! : actualRole;

  // Check if an admin is impersonating another user.
  const canImpersonate =
    (ROLE_RANK[actualRole] ?? 0) >= (ROLE_RANK["admin"] ?? 0);
  const previewUserId = canImpersonate
    ? jar.get("preview_user_id")?.value
    : undefined;
  let impersonatedUser:
    | { id: string; email: string | null; name: string | null; isOnboarding: boolean }
    | undefined;
  if (previewUserId) {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isOnboarding: users.isOnboarding,
      })
      .from(users)
      .where(
        and(
          eq(users.id, previewUserId),
          eq(users.workspaceId, session.user.workspaceId!),
        ),
      );
    impersonatedUser = row;
  }
  const isImpersonating = !!impersonatedUser;

  // Onboardees get a restricted experience: only the onboarding portal and
  // resources. Enforce it here (a single choke point for all /(app) routes)
  // using the pathname exposed by proxy.ts.
  // Admins who are impersonating are exempt from the redirect so they can
  // keep accessing the admin panel while the banner is shown.
  const isOnboarding = userRow?.isOnboarding ?? false;
  if (isOnboarding && !isImpersonating) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const allowed = ["/portal", "/resources"];
    const isAllowed = allowed.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (!isAllowed) redirect("/portal");
  }

  // When impersonating, show the sidebar as the impersonated user sees it.
  const sidebarIsOnboarding = isImpersonating
    ? (impersonatedUser?.isOnboarding ?? false)
    : isOnboarding;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {isImpersonating && impersonatedUser && (
        <ImpersonationBanner
          userEmail={impersonatedUser.email ?? impersonatedUser.name ?? "Unknown user"}
        />
      )}
      {!isImpersonating && isValidPreview && (
        <RolePreviewBanner previewRole={previewRoleCookie!} actualRole={actualRole} />
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          user={{ email: session.user.email, name: session.user.name }}
          role={effectiveRole}
          toolAccess={userRow?.toolAccess ?? "all"}
          isOnboarding={sidebarIsOnboarding}
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
