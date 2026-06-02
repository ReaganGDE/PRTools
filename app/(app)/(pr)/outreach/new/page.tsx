import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactLists, contactListMembers } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { NewCampaignForm } from "./form";

export default async function NewOutreachPage() {
  const session = await requireSession();

  const lists = await db
    .select({
      id: contactLists.id,
      name: contactLists.name,
      memberCount: sql<number>`count(${contactListMembers.contactId})::int`,
    })
    .from(contactLists)
    .leftJoin(
      contactListMembers,
      eq(contactListMembers.listId, contactLists.id),
    )
    .where(eq(contactLists.workspaceId, session.workspaceId))
    .groupBy(contactLists.id);

  if (lists.length === 0) {
    return (
      <>
        <PageHeader title="New outreach campaign" />
        <div className="p-8">
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              You need at least one contact list first.
            </p>
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link href="/contacts/lists">Create list</Link>
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="New outreach campaign"
        description="One platform, one list, one message template."
      />
      <div className="p-8">
        <NewCampaignForm lists={lists} />
      </div>
    </>
  );
}
