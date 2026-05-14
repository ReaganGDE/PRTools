import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function SocialPage() {
  return (
    <>
      <PageHeader
        title="Social"
        description="Cross-post to your connected accounts."
      />
      <ComingSoon
        phase="Phase 6"
        description="Write once, post to Reddit, YouTube, Instagram, and Facebook Page."
      />
    </>
  );
}
