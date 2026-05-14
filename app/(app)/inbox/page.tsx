import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function InboxPage() {
  return (
    <>
      <PageHeader
        title="Inbox"
        description="Incoming DMs and email replies."
      />
      <ComingSoon
        phase="Phase 4–7"
        description="Unified inbox: Reddit DMs (auto), Instagram DMs (via Graph API), email replies."
      />
    </>
  );
}
