import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { ChevronLeft, Play } from "lucide-react";
import { db } from "@/lib/db";
import { socialPosts } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { deletePost } from "../actions";
import { EditPostForm } from "./edit-form";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [post] = await db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.id, id),
        eq(socialPosts.workspaceId, session.workspaceId),
      ),
    );

  if (!post) notFound();

  const accounts = post.oneupSocialNetworkIds ?? [];
  const platformTypes = [...new Set(accounts.map((a) => a.type.toLowerCase()))];
  const hasTitle = platformTypes.some(
    (t) => t.includes("reddit") || t.includes("youtube") || t.includes("threads"),
  );

  const isEditable =
    post.status === "draft" ||
    post.status === "scheduled" ||
    post.status === "failed";

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link
          href="/social"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" /> Back to posts
        </Link>
      </div>

      <div className="grid gap-5">
        {/* Header card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <PlatformPill platform={post.platform} />
            {post.mediaKind && (
              <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {post.mediaKind}
              </span>
            )}
            <StatusBadge status={post.status} />
          </div>

          {accounts.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {accounts.map((a) => (
                <span
                  key={a.id}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium dark:bg-zinc-800"
                >
                  {a.type}: {a.name}
                </span>
              ))}
            </div>
          )}

          {post.title && (
            <h1 className="mb-2 text-lg font-semibold">{post.title}</h1>
          )}
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {post.body}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800/60">
            <span>Created {post.createdAt.toLocaleString()}</span>
            {post.scheduledAt && post.status !== "posted" && (
              <span>Scheduled {post.scheduledAt.toLocaleString()}</span>
            )}
            {post.postedAt && (
              <span className="text-emerald-600 dark:text-emerald-400">
                Posted {post.postedAt.toLocaleString()}
              </span>
            )}
            {post.externalUrl && (
              <a
                href={post.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-red-600 hover:underline dark:text-red-400"
              >
                View live ↗
              </a>
            )}
          </div>
        </div>

        {/* Error card */}
        {post.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
            <p className="mb-1 text-sm font-medium text-red-800 dark:text-red-300">
              Post failed
            </p>
            <p className="text-xs text-red-700 dark:text-red-400">{post.error}</p>
          </div>
        )}

        {/* Media grid */}
        {post.mediaUrls.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Media
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {post.mediaUrls.map((url) => (
                <MediaThumb
                  key={url}
                  url={url}
                  kind={post.mediaKind ?? "image"}
                />
              ))}
            </div>
          </div>
        )}

        {/* Edit form */}
        <EditPostForm
          postId={post.id}
          status={post.status}
          title={post.title}
          body={post.body}
          scheduledAt={post.scheduledAt}
          hasTitle={hasTitle}
        />

        {/* Delete */}
        {isEditable && (
          <form action={deletePost.bind(null, post.id)}>
            <Button
              type="submit"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
            >
              Delete post
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function MediaThumb({ url, kind }: { url: string; kind: string }) {
  if (kind === "video") {
    return (
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-zinc-900">
        <Play className="h-8 w-8 text-white/70" />
        <span className="absolute bottom-1.5 left-2 text-[10px] text-white/60 truncate max-w-[90%]">
          {url.split("/").pop()}
        </span>
      </div>
    );
  }
  return (
    <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
      <Image src={url} alt="" fill className="object-cover" unoptimized />
    </div>
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
        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
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
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        cls,
      )}
    >
      {status}
    </span>
  );
}
