import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!session.user.workspaceId) {
    // First-time user without a workspace shouldn't normally happen
    // (createUser event handles it), but guard anyway.
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ email: session.user.email, name: session.user.name }} />
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
