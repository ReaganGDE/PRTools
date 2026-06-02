import Link from "next/link";
import { db } from "@/lib/db";
import { messageTemplates, campaigns } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function EmailPage() {
  const session = await requireSession();

  const templates = await db
    .select()
    .from(messageTemplates)
    .where(
      and(
        eq(messageTemplates.workspaceId, session.workspaceId),
        eq(messageTemplates.channel, "email"),
      ),
    )
    .orderBy(desc(messageTemplates.updatedAt))
    .limit(50);

  const campaignRows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.workspaceId, session.workspaceId),
        eq(campaigns.type, "email"),
      ),
    )
    .orderBy(desc(campaigns.createdAt))
    .limit(50);

  return (
    <>
      <PageHeader
        title="Email"
        description="Templates and bulk send campaigns."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/email/templates/new">New template</Link>
            </Button>
            <Button asChild>
              <Link href="/email/campaigns/new">New campaign</Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-6 p-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No templates yet.{" "}
                <Link
                  href="/email/templates/new"
                  className="text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  Create your first
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <Link
                      href={`/email/templates/${t.id}`}
                      className="hover:underline"
                    >
                      {t.name}
                    </Link>
                    <span className="text-xs text-zinc-500">
                      {t.mergeFields.length} merge fields
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignRows.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No campaigns yet.{" "}
                <Link
                  href="/email/campaigns/new"
                  className="text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  Create one
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {campaignRows.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <Link
                      href={`/email/campaigns/${c.id}`}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="text-xs text-zinc-500">{c.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
