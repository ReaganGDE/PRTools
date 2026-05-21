"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, lte, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { socialPosts } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { del } from "@vercel/blob";
import { scheduleImagePost, scheduleVideoPost } from "@/lib/platforms/oneup";
import { logAudit } from "@/lib/audit";

const SocialAccount = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.string(),
});

const PostInput = z.object({
  categoryId: z.string().min(1),
  accounts: z.array(SocialAccount).min(1),
  mediaKind: z.enum(["image", "video"]),
  mediaUrls: z.array(z.string().url()).min(1),
  thumbnailUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  title: z.string().optional(),
  body: z.string().min(1),
  subreddit: z.string().optional(),
  scheduledAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});

function dominantPlatform(
  accounts: { type: string }[],
):
  | "instagram"
  | "tiktok"
  | "reddit"
  | "youtube"
  | "facebook"
  | "x"
  | "linkedin"
  | "pinterest"
  | "gbp"
  | "threads"
  | "snapchat"
  | "bluesky"
  | "multi" {
  const types = new Set(accounts.map((a) => normalizeType(a.type)));
  if (types.size > 1) return "multi";
  const t = [...types][0];
  return t;
}

function normalizeType(
  t: string,
):
  | "instagram"
  | "tiktok"
  | "reddit"
  | "youtube"
  | "facebook"
  | "x"
  | "linkedin"
  | "pinterest"
  | "gbp"
  | "threads"
  | "snapchat"
  | "bluesky" {
  const k = t.toLowerCase();
  if (k.includes("instagram")) return "instagram";
  if (k.includes("tiktok")) return "tiktok";
  if (k.includes("reddit")) return "reddit";
  if (k.includes("youtube")) return "youtube";
  if (k.includes("facebook")) return "facebook";
  if (k === "x" || k.includes("twitter")) return "x";
  if (k.includes("linkedin")) return "linkedin";
  if (k.includes("pinterest")) return "pinterest";
  if (k.includes("gbp") || k.includes("google")) return "gbp";
  if (k.includes("threads")) return "threads";
  if (k.includes("snapchat")) return "snapchat";
  if (k.includes("bluesky")) return "bluesky";
  return "multi" as never;
}

// "YYYY-MM-DDTHH:MM" (from datetime-local) → "YYYY-MM-DD HH:MM" for OneUp
function toOneUpDateTime(localStr: string): string {
  return localStr.replace("T", " ");
}

export async function createPost(formData: FormData) {
  const session = await requireSessionWithCap("social.post.create");

  const accountsRaw = formData.get("accounts");
  const mediaUrlsRaw = formData.get("mediaUrls");
  // clientNow is the user's local datetime at submit time, sent by the form
  const clientNow = formData.get("clientNow") as string | null;
  const parsed = PostInput.parse({
    categoryId: formData.get("categoryId"),
    accounts: accountsRaw ? JSON.parse(String(accountsRaw)) : [],
    mediaKind: formData.get("mediaKind"),
    mediaUrls: mediaUrlsRaw ? JSON.parse(String(mediaUrlsRaw)) : [],
    thumbnailUrl: formData.get("thumbnailUrl") ?? undefined,
    title: formData.get("title") ?? undefined,
    body: formData.get("body"),
    subreddit: formData.get("subreddit") ?? undefined,
    scheduledAt: formData.get("scheduledAt") ?? undefined,
  });

  const action = formData.get("action") as string | null;
  const status: "scheduled" | "posted" | "draft" =
    action === "publish"
      ? "posted"
      : action === "schedule" && parsed.scheduledAt
        ? "scheduled"
        : "draft";
  const scheduledAt =
    action === "publish" ? new Date() : parsed.scheduledAt ?? null;

  const platform = dominantPlatform(parsed.accounts);
  const ids = parsed.accounts.map((a) => a.id);

  // For "post now": call OneUp immediately with the user's local time so
  // it schedules for right now rather than offset into the future.
  let postError: string | null = null;
  if (action === "publish") {
    const oneupTime = clientNow
      ? toOneUpDateTime(clientNow)
      : toOneUpDateTime(new Date().toISOString().slice(0, 16));
    const common = {
      categoryId: parsed.categoryId,
      socialNetworkIds: ids,
      scheduledAt: oneupTime,
      content: parsed.body,
      title: parsed.title,
      subreddit: parsed.subreddit,
    };
    try {
      if (parsed.mediaKind === "video") {
        await scheduleVideoPost({
          ...common,
          videoUrl: parsed.mediaUrls[0],
          thumbnailUrl: parsed.thumbnailUrl,
        });
      } else {
        await scheduleImagePost({ ...common, imageUrls: parsed.mediaUrls });
      }
    } catch (e) {
      postError = (e as Error).message;
    }
  }

  const [row] = await db
    .insert(socialPosts)
    .values({
      workspaceId: session.workspaceId,
      platform,
      body: parsed.body,
      title: parsed.title ?? null,
      mediaUrls: parsed.mediaUrls,
      mediaKind: parsed.mediaKind,
      thumbnailUrl: parsed.thumbnailUrl ?? null,
      subreddit: parsed.subreddit ?? null,
      oneupCategoryId: parsed.categoryId,
      oneupSocialNetworkIds: parsed.accounts,
      status: postError ? "failed" : status,
      error: postError,
      postedAt: action === "publish" && !postError ? new Date() : null,
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
      platform,
      accounts: parsed.accounts.length,
      mediaKind: parsed.mediaKind,
      status,
      scheduledAt: scheduledAt?.toISOString() ?? null,
    },
  });

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
    if (!post.oneupCategoryId || !post.oneupSocialNetworkIds) {
      throw new Error("Post is missing OneUp routing data");
    }
    if (!post.mediaUrls || post.mediaUrls.length === 0) {
      throw new Error("Post has no media attached");
    }
    const ids = post.oneupSocialNetworkIds.map((a) => a.id);
    // Cron fires when the post is due — pass current time so OneUp processes it now.
    const now = new Date();
    const nowStr = toOneUpDateTime(now.toISOString().slice(0, 16));
    const common = {
      categoryId: post.oneupCategoryId,
      socialNetworkIds: ids,
      scheduledAt: nowStr,
      content: post.body,
      title: post.title ?? undefined,
      subreddit: post.subreddit ?? undefined,
    };

    if (post.mediaKind === "video") {
      await scheduleVideoPost({
        ...common,
        videoUrl: post.mediaUrls[0],
        thumbnailUrl: post.thumbnailUrl ?? undefined,
      });
    } else {
      await scheduleImagePost({
        ...common,
        imageUrls: post.mediaUrls,
      });
    }

    await db
      .update(socialPosts)
      .set({
        status: "posted",
        postedAt: new Date(),
      })
      .where(eq(socialPosts.id, post.id));
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

// Deletes Vercel Blob media for posts that resolved (posted or failed) more
// than `daysOld` ago, then clears the URLs from the row so we don't try again.
// Only touches URLs on Vercel Blob — pasted public URLs are left alone.
export async function sweepOldMedia(
  daysOld = 14,
): Promise<{ scanned: number; deleted: number }> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: socialPosts.id,
      mediaUrls: socialPosts.mediaUrls,
      thumbnailUrl: socialPosts.thumbnailUrl,
    })
    .from(socialPosts)
    .where(
      and(
        or(
          eq(socialPosts.status, "posted"),
          eq(socialPosts.status, "failed"),
        )!,
        lte(socialPosts.postedAt, cutoff),
      ),
    )
    .limit(500);

  let deleted = 0;
  for (const r of rows) {
    const blobUrls = [...r.mediaUrls, r.thumbnailUrl ?? ""].filter(
      (u) => u && u.includes(".public.blob.vercel-storage.com"),
    );
    if (blobUrls.length === 0) continue;
    try {
      await del(blobUrls);
      deleted += blobUrls.length;
    } catch (err) {
      console.error("[sweepOldMedia] failed to delete blobs", r.id, err);
      continue;
    }
    await db
      .update(socialPosts)
      .set({
        mediaUrls: r.mediaUrls.filter(
          (u) => !u.includes(".public.blob.vercel-storage.com"),
        ),
        thumbnailUrl: r.thumbnailUrl?.includes(".public.blob.vercel-storage.com")
          ? null
          : r.thumbnailUrl,
      })
      .where(eq(socialPosts.id, r.id));
  }
  return { scanned: rows.length, deleted };
}

// Used by /social/new — list OneUp categories for picker.
export async function listOneUpCategories() {
  await requireSessionWithCap("social.post.create");
  const { listCategories } = await import("@/lib/platforms/oneup");
  return listCategories();
}

// Used by /social/new — list accounts for a chosen category.
export async function listOneUpCategoryAccounts(categoryId: string) {
  await requireSessionWithCap("social.post.create");
  const { listCategoryAccounts } = await import("@/lib/platforms/oneup");
  return listCategoryAccounts(categoryId);
}
