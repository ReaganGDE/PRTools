import { requireSectionAccess } from "@/lib/tool-access";

export default async function PrSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSectionAccess("pr");
  return <>{children}</>;
}
