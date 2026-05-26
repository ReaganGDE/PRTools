import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { Sidebar } from "@/components/sidebar";
import {
  ensureDefaultBrands,
  getActiveBrandId,
  getBrandsForWorkspace,
} from "@/lib/brand-context";

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
          .select({ role: users.role, toolAccess: users.toolAccess })
          .from(users)
          .where(eq(users.id, session.user.id))
          .then((r) => r[0])
      : Promise.resolve(undefined),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={{ email: session.user.email, name: session.user.name }}
        role={userRow?.role ?? "member"}
        toolAccess={userRow?.toolAccess ?? "all"}
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
  );
}
