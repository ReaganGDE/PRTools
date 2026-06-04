import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts, sends, campaigns } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ReplyToggle } from "@/components/reply-toggle";

const PAGE_SIZE = 50;

export default async function InboxPage() {
  const session = await requireSession();

  const rows = await db
    .select({
      id: sends.id,
      repliedAt: sends.repliedAt,
      subject: sends.renderedSubject,
      body: sends.renderedBody,
      contactId: sends.contactId,
      contactName: contacts.name,
      campaignName: campaigns.name,
    })
    .from(sends)
    .innerJoin(contacts, eq(sends.contactId, contacts.id))
    .leftJoin(campaigns, eq(sends.campaignId, campaigns.id))
    .where(
      and(
        eq(sends.workspaceId, session.workspaceId),
        isNotNull(sends.repliedAt),
      ),
    )
    .orderBy(desc(sends.repliedAt))
    .limit(PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="PR Inbox"
        description="Email replies from press contacts and journalists."
      />
      <div className="space-y-4 p-8">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              No replies yet. Responses to your email campaigns will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {rows.map((r) => {
                if (!r.repliedAt) return null;
                return (
                  <li key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            email reply
                          </span>
                          {r.contactId ? (
                            <Link
                              href={`/contacts/${r.contactId}`}
                              className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                            >
                              {r.contactName}
                            </Link>
                          ) : (
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {r.contactName}
                            </span>
                          )}
                          {r.campaignName ? (
                            <span className="text-zinc-400">· {r.campaignName}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                          {r.subject ?? r.body?.slice(0, 200) ?? "(no subject)"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <time className="text-xs text-zinc-500">
                          {formatRelative(r.repliedAt)}
                        </time>
                        <ReplyToggle sendId={r.id} initialReplied />
                        {r.contactId ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/contacts/${r.contactId}`}>Open</Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-900">
              Showing {rows.length} most recent.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function formatRelative(d: Date) {
  const diff = Date.now() - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString();
}
