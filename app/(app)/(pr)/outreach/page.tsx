import Link from "next/link";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, sends } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OutreachPage() {
  const session = await requireSession();

  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      platform: campaigns.platform,
      status: campaigns.status,
      createdAt: campaigns.createdAt,
      sendCount: sql<number>`count(${sends.id})::int`,
    })
    .from(campaigns)
    .leftJoin(sends, eq(sends.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.workspaceId, session.workspaceId),
        eq(campaigns.type, "workbench"),
      ),
    )
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.createdAt));

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Semi-autonomous DM workbench for Instagram, TikTok, Reddit, YouTube."
        actions={
          <Button asChild>
            <Link href="/outreach/new">New campaign</Link>
          </Button>
        }
      />
      <div className="p-8">
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="text-base">How the workbench works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-700 dark:text-zinc-300">
            <ol className="ml-4 list-decimal space-y-1">
              <li>Pick a platform, a list of contacts, and write a message with merge fields like <code>{`{{first_name}}`}</code>.</li>
              <li>Workbench shows each contact one at a time with the personalized message.</li>
              <li>Click <strong>Copy & open</strong>. The message is copied to your clipboard and the platform opens in a new tab.</li>
              <li>Paste, send manually, come back, click <strong>Mark sent</strong>. Next contact loads.</li>
            </ol>
            <p className="mt-3 text-xs text-zinc-500">
              Reddit pre-fills the compose box, so it&apos;s one click. Instagram/TikTok/YouTube require manual paste because their pages block message-prefill query params.
            </p>
          </CardContent>
        </Card>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              No outreach campaigns yet.{" "}
              <Link href="/outreach/new" className="hover:underline">
                Create your first
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <Link
                    href={`/outreach/${c.id}/workbench`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {c.platform} · {c.status} · {c.sendCount} processed
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/outreach/${c.id}/workbench`}>Open workbench</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
