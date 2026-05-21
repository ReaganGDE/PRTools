import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
  const [brands, activeBrandId] = await Promise.all([
    getBrandsForWorkspace(session.user.workspaceId),
    getActiveBrandId(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{ email: session.user.email, name: session.user.name }}
        brands={brands.map((b) => ({
          id: b.id,
          name: b.name,
          color: b.color,
          type: b.type,
        }))}
        activeBrandId={activeBrandId}
      />
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
