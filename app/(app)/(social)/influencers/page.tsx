import { requireSession } from "@/lib/auth-helpers";
import { requireSectionAccess } from "@/lib/tool-access";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { InfluencerFinder } from "./finder";

export default async function InfluencersPage() {
  await requireSectionAccess("social");
  await requireSession();

  return (
    <>
      <PageHeader
        title="Influencer finder"
        description="Discover creators by niche and see real reach & engagement before you reach out."
      />
      <div className="mx-auto max-w-5xl p-8">
        <InfluencerFinder
          youtubeEnabled={Boolean(env.YOUTUBE_API_KEY)}
          modashEnabled={Boolean(env.MODASH_API_KEY)}
        />
      </div>
    </>
  );
}
