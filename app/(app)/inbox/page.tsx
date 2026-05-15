import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contacts,
  dmMessages,
  dmThreads,
  sends,
  campaigns,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 50;

type InboxItem = {
  kind: "dm" | "email";
  id: string;
  at: Date;
  platform: string;
  contactId: string | null;
  contactName: string;
  preview: string;
  context?: string;
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; platform?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const source = sp.source ?? "all";
  const platform = sp.platform;

  const items: InboxItem[] = [];

  if (source !== "email") {
    const dmConds = [
      eq(dmThreads.workspaceId, session.workspaceId),
      eq(dmMessages.direction, "inbound"),
    ];
    if (platform) {
      dmConds.push(
        eq(
          dmThreads.platform,
          platform as
            | "instagram"
            | "tiktok"
            | "reddit"
            | "youtube"
            | "facebook"
            | "email",
        ),
      );
    }
    const dmRows = await db
      .select({
        id: dmMessages.id,
        body: dmMessages.body,
        sentAt: dmMessages.sentAt,
        platform: dmThreads.platform,
        contactId: dmThreads.contactId,
        contactName: contacts.name,
      })
      .from(dmMessages)
      .innerJoin(dmThreads, eq(dmMessages.threadId, dmThreads.id))
      .leftJoin(contacts, eq(dmThreads.contactId, contacts.id))
      .where(and(...dmConds))
      .orderBy(desc(dmMessages.sentAt))
      .limit(PAGE_SIZE);

    for (const r of dmRows) {
      items.push({
        kind: "dm",
        id: r.id,
        at: r.sentAt,
        platform: r.platform,
        contactId: r.contactId,
        contactName: r.contactName ?? "Unknown contact",
        preview: r.body,
      });
    }
  }

  if (source !== "dms") {
    const replyRows = await db
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

    for (const r of replyRows) {
      if (!r.repliedAt) continue;
      items.push({
        kind: "email",
        id: r.id,
        at: r.repliedAt,
        platform: "email",
        contactId: r.contactId,
        contactName: r.contactName,
        preview: r.subject ?? r.body?.slice(0, 200) ?? "(no subject)",
        context: r.campaignName ?? undefined,
      });
    }
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  const visible = items.slice(0, PAGE_SIZE);

  const filterLink = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { source, platform, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/inbox?${qs}` : "/inbox";
  };

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Incoming DMs and email replies, in one place."
      />
      <div className="space-y-4 p-8">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill href={filterLink({ source: "all" })} active={source === "all"}>
            All
          </FilterPill>
          <FilterPill
            href={filterLink({ source: "dms", platform: undefined })}
            active={source === "dms"}
          >
            DMs
          </FilterPill>
          <FilterPill
            href={filterLink({ source: "email", platform: undefined })}
            active={source === "email"}
          >
            Email replies
          </FilterPill>
          {source !== "email" ? (
            <>
              <span className="ml-2 text-xs text-zinc-400">Platform:</span>
              <FilterPill
                href={filterLink({ platform: undefined })}
                active={!platform}
              >
                Any
              </FilterPill>
              {(["instagram", "tiktok", "reddit", "youtube"] as const).map(
                (p) => (
                  <FilterPill
                    key={p}
                    href={filterLink({ platform: p })}
                    active={platform === p}
                  >
                    {p}
                  </FilterPill>
                ),
              )}
            </>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              No incoming activity yet. Replies and inbound DMs will land here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {visible.map((item) => (
                <li key={`${item.kind}:${item.id}`} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <KindBadge kind={item.kind} platform={item.platform} />
                        {item.contactId ? (
                          <Link
                            href={`/contacts/${item.contactId}`}
                            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                          >
                            {item.contactName}
                          </Link>
                        ) : (
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {item.contactName}
                          </span>
                        )}
                        {item.context ? (
                          <span className="text-zinc-400">
                            · {item.context}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {item.preview}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <time className="text-xs text-zinc-500">
                        {formatRelative(item.at)}
                      </time>
                      {item.contactId ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/contacts/${item.contactId}`}>
                            Open
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-900">
              Showing {visible.length} most recent.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900")
      }
    >
      {children}
    </Link>
  );
}

function KindBadge({ kind, platform }: { kind: "dm" | "email"; platform: string }) {
  const label = kind === "email" ? "email reply" : `${platform} DM`;
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {label}
    </span>
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
