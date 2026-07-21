import { requireSession } from "@/lib/auth-helpers";
import { requireSectionAccess } from "@/lib/tool-access";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { InfluencerTabs } from "../tabs";
import { EngagementAnalyzer } from "./analyzer";

export default async function AnalyzePage() {
  await requireSectionAccess("social");
  await requireSession();

  return (
    <>
      <PageHeader
        title="Engagement analyzer"
        description="Look up any influencer's real engagement — followers, averages, and a per-post breakdown."
      />
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <InfluencerTabs />
        <EngagementAnalyzer
          youtubeEnabled={Boolean(env.YOUTUBE_API_KEY)}
          modashEnabled={Boolean(env.MODASH_API_KEY)}
        />
      </div>
    </>
  );
}
