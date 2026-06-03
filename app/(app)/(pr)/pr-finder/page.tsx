import { requireSession } from "@/lib/auth-helpers";
import { requireSectionAccess } from "@/lib/tool-access";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { PrFinder } from "./finder";

export default async function PrFinderPage() {
  await requireSectionAccess("pr");
  await requireSession();

  return (
    <>
      <PageHeader
        title="PR contact finder"
        description="Search your press contacts and discover new journalists writing about a topic."
      />
      <div className="mx-auto max-w-5xl p-8">
        <PrFinder newsEnabled={Boolean(env.NEWS_API_KEY)} />
      </div>
    </>
  );
}
