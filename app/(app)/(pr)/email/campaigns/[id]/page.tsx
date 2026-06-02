import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  campaigns,
  messageTemplates,
  contactLists,
  contactListMembers,
  sends,
  contacts,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sendCampaign } from "../../actions";

export default async function CampaignDetailPage({
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
      and(
        eq(campaigns.id, id),
        eq(campaigns.workspaceId, session.workspaceId),
      ),
    );
  if (!campaign) notFound();

  const [template] = campaign.templateId
    ? await db
        .select()
        .from(messageTemplates)
        .where(eq(messageTemplates.id, campaign.templateId))
    : [null];

  const [list] = campaign.listId
    ? await db
        .select({
          id: contactLists.id,
          name: contactLists.name,
        })
        .from(contactLists)
        .where(eq(contactLists.id, campaign.listId))
    : [null];

  let memberCount = 0;
  if (campaign.listId) {
    const r = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(contactListMembers)
      .where(eq(contactListMembers.listId, campaign.listId));
    memberCount = r[0]?.value ?? 0;
  }

  const sendRows = await db
    .select({
      id: sends.id,
      status: sends.status,
      sentAt: sends.sentAt,
      openedAt: sends.openedAt,
      clickedAt: sends.clickedAt,
      repliedAt: sends.repliedAt,
      error: sends.error,
      contactName: contacts.name,
      contactEmail: contacts.email,
    })
    .from(sends)
    .innerJoin(contacts, eq(contacts.id, sends.contactId))
    .where(eq(sends.campaignId, campaign.id))
    .orderBy(desc(sends.createdAt))
    .limit(200);

  const stats = sendRows.reduce(
    (acc, s) => {
      if (s.status === "sent" || s.status === "delivered") acc.sent++;
      if (s.openedAt) acc.opened++;
      if (s.clickedAt) acc.clicked++;
      if (s.repliedAt) acc.replied++;
      if (s.status === "failed") acc.failed++;
      return acc;
    },
    { sent: 0, opened: 0, clicked: 0, replied: 0, failed: 0 },
  );

  const boundSend = async () => {
    "use server";
    await sendCampaign(campaign.id);
  };

  const canSend = campaign.status === "draft" || campaign.status === "paused";

  return (
    <>
      <PageHeader
        title={campaign.name}
        description={`Status: ${campaign.status}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/api/export/sends?campaignId=${campaign.id}`}>
                Export sends
              </Link>
            </Button>
            {canSend ? (
              <form action={boundSend}>
                <Button type="submit">Send to {memberCount} contacts</Button>
              </form>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template</CardTitle>
          </CardHeader>
          <CardContent>
            {template ? (
              <Link
                href={`/email/templates/${template.id}`}
                className="text-sm hover:underline"
              >
                {template.name}
              </Link>
            ) : (
              <p className="text-sm text-zinc-500">Template missing</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">List</CardTitle>
          </CardHeader>
          <CardContent>
            {list ? (
              <Link
                href={`/contacts?list=${list.id}`}
                className="text-sm hover:underline"
              >
                {list.name} ({memberCount} contacts)
              </Link>
            ) : (
              <p className="text-sm text-zinc-500">List missing</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stats</CardTitle>
            <CardDescription>Open/click/reply tracking via Resend webhook.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between"><span>Sent</span><strong>{stats.sent}</strong></li>
              <li className="flex justify-between"><span>Opened</span><strong>{stats.opened}</strong></li>
              <li className="flex justify-between"><span>Clicked</span><strong>{stats.clicked}</strong></li>
              <li className="flex justify-between"><span>Replied</span><strong>{stats.replied}</strong></li>
              <li className="flex justify-between"><span>Failed</span><strong>{stats.failed}</strong></li>
            </ul>
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Recipients
          </h2>
          {sendRows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nothing sent yet. Press &quot;Send to {memberCount} contacts&quot; above when ready.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2 font-medium">Recipient</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Opened</th>
                    <th className="px-4 py-2 font-medium">Clicked</th>
                    <th className="px-4 py-2 font-medium">Replied</th>
                  </tr>
                </thead>
                <tbody>
                  {sendRows.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <td className="px-4 py-2">
                        {s.contactName}
                        <div className="text-xs text-zinc-500">
                          {s.contactEmail}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {s.status}
                        {s.error ? (
                          <div className="text-red-600">{s.error}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-500">
                        {s.openedAt ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-500">
                        {s.clickedAt ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-500">
                        {s.repliedAt ? "✓" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
