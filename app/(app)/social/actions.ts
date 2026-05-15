"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, lte, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { socialPosts } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { submitRedditPost } from "@/lib/platforms/reddit";
import { logAudit } from "@/lib/audit";

const PLATFORM = z.enum(["reddit", "youtube", "facebook", "instagram"]);

const PostInput = z.object({
  platform: PLATFORM,
  body: z.string().min(1),
  // Reddit-specific
  subreddit: z.string().optional(),
  title: z.string().optional(),
  linkUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  scheduledAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});

export async function createPost(formData: FormData) {
  const session = await requireSessionWithCap("social.post.create");
  const parsed = PostInput.parse({
    platform: formData.get("platform"),
    body: formData.get("body"),
    subreddit: formData.get("subreddit") ?? undefined,
    title: formData.get("title") ?? undefined,
    linkUrl: formData.get("linkUrl") ?? undefined,
    scheduledAt: formData.get("scheduledAt") ?? undefined,
  });

  // For Reddit, encode subreddit + title into post body metadata
  const fullBody =
    parsed.platform === "reddit"
      ? JSON.stringify({
          subreddit: parsed.subreddit ?? "",
          title: parsed.title ?? "",
          body: parsed.body,
          linkUrl: parsed.linkUrl ?? null,
        })
      : parsed.body;

  const action = formData.get("action") as string | null;
  // "publish" → publish immediately, "schedule" → save for cron, else draft
  const status =
    action === "publish"
      ? ("scheduled" as const) // mark scheduled now, executor will pick it up
      : action === "schedule" && parsed.scheduledAt
        ? ("scheduled" as const)
        : ("draft" as const);

  const scheduledAt =
    action === "publish" ? new Date() : parsed.scheduledAt ?? null;

  const [row] = await db
    .insert(socialPosts)
    .values({
      workspaceId: session.workspaceId,
      platform: parsed.platform,
      body: fullBody,
      mediaUrls: [],
      status,
      scheduledAt,
      createdBy: session.userId,
    })
    .returning({ id: socialPosts.id });

  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action:
      action === "publish" ? "social.post.publish" : "social.post.create",
    targetType: "social_post",
    targetId: row.id,
    meta: {
      platform: parsed.platform,
      status,
      scheduledAt: scheduledAt?.toISOString() ?? null,
    },
  });

  // If publishing now, run inline
  if (action === "publish") {
    await runPost(row.id);
  }

  revalidatePath("/social");
  redirect("/social");
}

export async function runPost(postId: string): Promise<void> {
  const [post] = await db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.id, postId));
  if (!post) throw new Error("Post not found");
  if (post.status === "posted") return;

  try {
    if (post.platform === "reddit") {
      const meta = JSON.parse(post.body) as {
        subreddit: string;
        title: string;
        body: string;
        linkUrl: string | null;
      };
      if (!meta.subreddit || !meta.title) {
        throw new Error("Reddit post missing subreddit or title");
      }
      const result = await submitRedditPost({
        subreddit: meta.subreddit,
        title: meta.title,
        body: meta.body,
        url: meta.linkUrl ?? undefined,
      });
      await db
        .update(socialPosts)
        .set({
          status: "posted",
          postedAt: new Date(),
          externalId: result.id,
          externalUrl: result.url,
        })
        .where(eq(socialPosts.id, post.id));
    } else {
      throw new Error(
        `Posting to ${post.platform} is not yet implemented (needs OAuth).`,
      );
    }
  } catch (e) {
    await db
      .update(socialPosts)
      .set({
        status: "failed",
        error: (e as Error).message,
      })
      .where(eq(socialPosts.id, post.id));
    throw e;
  }
}

export async function deletePost(postId: string) {
  const session = await requireSessionWithCap("social.post.create");
  await db
    .delete(socialPosts)
    .where(
      and(
        eq(socialPosts.id, postId),
        eq(socialPosts.workspaceId, session.workspaceId),
      ),
    );
  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "social.post.delete",
    targetType: "social_post",
    targetId: postId,
  });
  revalidatePath("/social");
}

export async function runDuePostsForAllWorkspaces(): Promise<{
  attempted: number;
  posted: number;
  failed: number;
}> {
  const due = await db
    .select({ id: socialPosts.id })
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.status, "scheduled"),
        or(
          isNull(socialPosts.scheduledAt),
          lte(socialPosts.scheduledAt, new Date()),
        )!,
      ),
    )
    .limit(100);

  let posted = 0;
  let failed = 0;
  for (const p of due) {
    try {
      await runPost(p.id);
      posted++;
    } catch {
      failed++;
    }
  }
  return { attempted: due.length, posted, failed };
}
