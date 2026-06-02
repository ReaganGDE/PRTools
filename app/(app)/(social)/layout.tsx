import { requireSectionAccess } from "@/lib/tool-access";

export default async function SocialSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSectionAccess("social");
  return <>{children}</>;
}
