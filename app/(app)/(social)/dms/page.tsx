import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts, dmMessages, dmThreads } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 50;

const PLATFORMS = ["instagram", "tiktok", "reddit", "youtube", "facebook", "x", "threads"] as const;
type Platform = (typeof PLATFORMS)[number];

export default async function DmsPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const platform = sp.platform as Platform | undefined;

  const conds = [
    eq(dmThreads.workspaceId, session.workspaceId),
    eq(dmMessages.direction, "inbound"),
  ];
  if (platform) {
    conds.push(eq(dmThreads.platform, platform as "instagram" | "tiktok" | "reddit" | "youtube" | "facebook" | "email" | "x" | "linkedin" | "pinterest" | "gbp" | "threads" | "snapchat" | "bluesky" | "multi"));
  }

  const rows = await db
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
    .where(and(...conds))
    .orderBy(desc(dmMessages.sentAt))
    .limit(PAGE_SIZE);

  const filterLink = (p: Platform | undefined) => {
    if (!p) return "/dms";
    return `/dms?platform=${p}`;
  };

  return (
    <>
      <PageHeader
        title="DMs"
        description="Inbound direct messages across all social platforms."
      />
      <div className="space-y-4 p-8">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill href="/dms" active={!platform}>All platforms</FilterPill>
          {PLATFORMS.map((p) => (
            <FilterPill key={p} href={filterLink(p)} active={platform === p}>
              {p}
            </FilterPill>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              No inbound DMs yet. Messages from connected social accounts will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {rows.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {r.platform} DM
                        </span>
                        {r.contactId ? (
                          <Link
                            href={`/contacts/${r.contactId}`}
                            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                          >
                            {r.contactName ?? "Unknown"}
                          </Link>
                        ) : (
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {r.contactName ?? "Unknown"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {r.body}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <time className="text-xs text-zinc-500">
                        {formatRelative(r.sentAt)}
                      </time>
                      {r.contactId ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/contacts/${r.contactId}`}>Open</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
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
