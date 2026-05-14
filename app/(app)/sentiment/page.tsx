import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function SentimentPage() {
  return (
    <>
      <PageHeader
        title="Sentiment"
        description="What people are saying about your company and films."
      />
      <ComingSoon
        phase="Phase 5"
        description="Tracks news, Reddit, and YouTube mentions of your keywords. Sentiment scored by Claude."
      />
    </>
  );
}
