import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialPosts } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { deletePost } from "./actions";

export default async function SocialPage() {
  const session = await requireSession();
  const canCreate = can(session.role, "social.post.create");

  const rows = await db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.workspaceId, session.workspaceId))
    .orderBy(desc(socialPosts.createdAt))
    .limit(100);

  return (
    <>
      <PageHeader
        title="Social"
        description="Schedule image and video posts to any platform connected in OneUp."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/social/new">New post</Link>
            </Button>
          ) : null
        }
      />
      <div className="p-8">

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">No posts yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((p) => (
              <PostRow key={p.id} post={p} canEdit={canCreate} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function PostRow({
  post,
  canEdit,
}: {
  post: typeof socialPosts.$inferSelect;
  canEdit: boolean;
}) {
  const accounts = post.oneupSocialNetworkIds ?? [];
  return (
    <li className="rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize dark:bg-zinc-800">
              {post.platform}
            </span>
            {post.mediaKind ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
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
            <div className="mb-1 text-xs text-zinc-500">
              → {accounts.map((a) => `${a.type}: ${a.name}`).join(", ")}
            </div>
          ) : null}
          {post.title ? <div className="font-medium">{post.title}</div> : null}
          <p className="line-clamp-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {post.body}
          </p>
          {post.externalUrl ? (
            <a
              href={post.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs hover:underline"
            >
              View live ↗
            </a>
          ) : null}
          {post.error ? (
            <p className="mt-1 text-xs text-red-600">{post.error}</p>
          ) : null}
        </div>
        {canEdit && post.status !== "posted" ? (
          <form action={deletePost.bind(null, post.id)}>
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
            >
              Delete
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "posted"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
      : status === "failed"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
        : status === "scheduled"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
          : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>
  );
}
