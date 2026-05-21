import Link from "next/link";
import { eq, desc, and } from "drizzle-orm";
import { Calendar, List, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { socialPosts, brands } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { can } from "@/lib/permissions";
import { getActiveBrandId } from "@/lib/brand-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deletePost } from "./actions";
import { PostCalendar } from "./calendar";

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireSession();
  const canCreate = can(session.role, "social.post.create");
  const sp = await searchParams;
  const view = sp.view === "calendar" ? "calendar" : "list";
  const activeBrandId = await getActiveBrandId();

  const whereClause = activeBrandId
    ? and(
        eq(socialPosts.workspaceId, session.workspaceId),
        eq(socialPosts.brandId, activeBrandId),
      )
    : eq(socialPosts.workspaceId, session.workspaceId);

  const rows = await db
    .select({
      post: socialPosts,
      brandName: brands.name,
      brandColor: brands.color,
    })
    .from(socialPosts)
    .leftJoin(brands, eq(brands.id, socialPosts.brandId))
    .where(whereClause)
    .orderBy(desc(socialPosts.createdAt))
    .limit(100);

  const calendarPosts = rows.map((r) => ({
    id: r.post.id,
    title: r.post.title,
    body: r.post.body,
    platform: r.post.platform,
    status: r.post.status,
    scheduledAt: r.post.scheduledAt,
    postedAt: r.post.postedAt,
    brandColor: r.brandColor,
    brandName: r.brandName,
  }));

  return (
    <>
      <PageHeader
        title="Social"
        description="Schedule image and video posts to any platform connected in OneUp."
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle current={view} />
            {canCreate ? (
              <Button asChild>
                <Link href="/social/new">
                  <Plus className="h-4 w-4" /> New post
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="p-8">
        {rows.length === 0 ? (
          <EmptyState />
        ) : view === "calendar" ? (
          <PostCalendar posts={calendarPosts} />
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <PostRow
                key={r.post.id}
                post={r.post}
                brandName={r.brandName}
                brandColor={r.brandColor}
                canEdit={canCreate}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ViewToggle({ current }: { current: "list" | "calendar" }) {
  return (
    <div className="flex items-center rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href="/social?view=list"
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "list"
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
        )}
      >
        <List className="h-3.5 w-3.5" /> List
      </Link>
      <Link
        href="/social?view=calendar"
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "calendar"
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
        )}
      >
        <Calendar className="h-3.5 w-3.5" /> Calendar
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-16 text-center dark:border-zinc-700 dark:bg-zinc-900/20">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
        <Plus className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold">No posts yet</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Schedule your first post to Instagram, Reddit, YouTube, and more — all
        from one place.
      </p>
      <Button asChild className="mt-5">
        <Link href="/social/new">Create your first post</Link>
      </Button>
    </div>
  );
}

function PostRow({
  post,
  brandName,
  brandColor,
  canEdit,
}: {
  post: typeof socialPosts.$inferSelect;
  brandName: string | null;
  brandColor: string | null;
  canEdit: boolean;
}) {
  const accounts = post.oneupSocialNetworkIds ?? [];
  return (
    <li
      className="group rounded-xl border border-zinc-200/80 bg-white text-sm shadow-sm transition-all duration-150 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900"
      style={
        brandColor
          ? { borderLeftWidth: 3, borderLeftColor: brandColor }
          : undefined
      }
    >
      <Link href={`/social/${post.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {brandName && brandColor && (
                <span
                  className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium dark:bg-zinc-800"
                  title={brandName}
                >
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: brandColor }}
                  />
                  {brandName}
                </span>
              )}
              <PlatformPill platform={post.platform} />
              {post.mediaKind ? (
                <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  {post.mediaKind}
                </span>
              ) : null}
              <StatusBadge status={post.status} />
              {post.scheduledAt ? (
                <span className="text-xs text-zinc-500">
                  {post.status === "posted" ? "posted " : "scheduled "}
                  {(post.postedAt ?? post.scheduledAt).toLocaleString()}
                </span>
              ) : null}
            </div>
            {accounts.length > 0 ? (
              <div className="mb-1.5 text-xs text-zinc-500">
                {accounts.map((a) => `${a.type}: ${a.name}`).join(" · ")}
              </div>
            ) : null}
            {post.title ? (
              <div className="font-medium tracking-tight">{post.title}</div>
            ) : null}
            <p className="line-clamp-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {post.body}
            </p>
            {post.externalUrl ? (
              <span className="mt-2 inline-block text-xs font-medium text-red-600 dark:text-red-400">
                View live ↗
              </span>
            ) : null}
            {post.error ? (
              <p className="mt-1.5 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {post.error}
              </p>
            ) : null}
          </div>
          <span className="text-xs text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100">
            Edit →
          </span>
        </div>
      </Link>
      {canEdit && post.status !== "posted" ? (
        <div className="border-t border-zinc-100 px-4 py-2 dark:border-zinc-800/60">
          <form action={deletePost.bind(null, post.id)}>
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-600 opacity-0 group-hover:opacity-100 hover:text-red-700"
            >
              Delete
            </Button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

function PlatformPill({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    instagram: "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300",
    facebook: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    youtube: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
    reddit: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
    tiktok: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100",
    x: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
    linkedin: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    pinterest: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
    threads: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100",
    bluesky: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    snapchat: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-300",
    gbp: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    multi: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        colors[platform] ?? colors.multi,
      )}
    >
      {platform}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "posted"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "failed"
        ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
        : status === "scheduled"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", cls)}>
      {status}
    </span>
  );
}
