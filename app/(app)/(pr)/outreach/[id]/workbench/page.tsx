import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { fetchNext, completeCampaign } from "../../actions";
import { deepLinkFor, type Platform } from "@/lib/outreach/deep-links";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Workbench } from "./workbench";

export default async function WorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(
      and(eq(campaigns.id, id), eq(campaigns.workspaceId, session.workspaceId)),
    );
  if (!campaign) notFound();

  if (campaign.status === "completed") {
    redirect("/outreach");
  }

  const next = await fetchNext(campaign.id);

  if (!next) {
    return (
      <>
        <PageHeader
          title={campaign.name}
          description="No more contacts to process."
        />
        <div className="p-8">
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="mb-4 text-sm text-zinc-500">
              You&apos;ve worked through the entire list (or remaining contacts
              have no {campaign.platform} handle).
            </p>
            <form action={completeCampaign.bind(null, campaign.id)}>
              <Button type="submit">Mark campaign complete</Button>
            </form>
          </div>
        </div>
      </>
    );
  }

  const link = deepLinkFor(
    campaign.platform as Platform,
    next.contact,
    {
      body: next.rendered,
      subject: next.renderedSubject ?? undefined,
    },
  );

  return (
    <>
      <PageHeader
        title={campaign.name}
        description={`${campaign.platform} workbench`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/outreach">Exit</Link>
          </Button>
        }
      />
      <Workbench
        campaignId={campaign.id}
        contactId={next.contact.id}
        contactName={next.contact.name}
        contactOutlet={next.contact.outlet}
        contactBeat={next.contact.beat}
        contactFollowers={next.contact.followerCount}
        contactHandle={
          campaign.platform === "instagram"
            ? next.contact.handleInstagram
            : campaign.platform === "tiktok"
              ? next.contact.handleTiktok
              : campaign.platform === "reddit"
                ? next.contact.handleReddit
                : campaign.platform === "youtube"
                  ? next.contact.handleYoutube
                  : null
        }
        rendered={next.rendered}
        renderedSubject={next.renderedSubject}
        platform={campaign.platform as Platform}
        link={link}
        sentCount={next.sentCount}
        total={next.total}
      />
    </>
  );
}
