"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, lte, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { socialPosts, users } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { getSettings } from "@/lib/workspace-settings";
import { submitRedditPost } from "@/lib/platforms/reddit";

const PLATFORM = z.enum(["reddit", "youtube", "facebook", "instagram"]);

const PostInput = z.object({
  platforms: z.array(PLATFORM).min(1, "Pick at least one platform"),
  body: z.string().min(1),
  // Per-platform extras (Reddit needs subreddit + title; others get title fallback)
  subreddit: z.string().optional(),
  title: z.string().optional(),
  linkUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  scheduledAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  requestedApproverId: z.string().optional(),
});

function platformBody(
  platform: "reddit" | "youtube" | "facebook" | "instagram",
  input: {
    body: string;
    subreddit?: string;
    title?: string;
    linkUrl?: string;
  },
): string {
  if (platform === "reddit") {
    return JSON.stringify({
      subreddit: input.subreddit ?? "",
      title: input.title ?? "",
      body: input.body,
      linkUrl: input.linkUrl ?? null,
    });
  }
  return input.body;
}

export async function createPost(formData: FormData) {
  const session = await requireSessionWithCap("social.post.create");
  const platforms = formData.getAll("platforms").map(String);
  const parsed = PostInput.parse({
    platforms,
    body: formData.get("body"),
    subreddit: formData.get("subreddit") ?? undefined,
    title: formData.get("title") ?? undefined,
    linkUrl: formData.get("linkUrl") ?? undefined,
    scheduledAt: formData.get("scheduledAt") ?? undefined,
    requestedApproverId:
      (formData.get("requestedApproverId") as string) || undefined,
  });

  const settings = await getSettings(session.workspaceId);
  const needsApproval =
    session.role === "member" &&
    !!settings?.membersRequireApproval;

  const action = (formData.get("action") as string) ?? "draft";
  // Actions: "publish" (post now), "schedule" (use scheduledAt), "approval" (submit), "draft"
  let status: "draft" | "pending_approval" | "scheduled";
  let scheduledAt: Date | null = parsed.scheduledAt;

  if (needsApproval && action !== "draft") {
    status = "pending_approval";
  } else if (action === "publish") {
    status = "scheduled"; // immediate execution below
    scheduledAt = new Date();
  } else if (action === "schedule" && parsed.scheduledAt) {
    status = "scheduled";
  } else if (action === "approval") {
    status = "pending_approval";
  } else {
    status = "draft";
  }

  const requestedApproverId =
    status === "pending_approval"
      ? parsed.requestedApproverId ?? settings?.defaultApproverId ?? null
      : null;

  const groupId = parsed.platforms.length > 1 ? nanoid(12) : null;
  const rows = parsed.platforms.map((p) => ({
    workspaceId: session.workspaceId,
    groupId,
    platform: p as "reddit" | "youtube" | "facebook" | "instagram",
    body: platformBody(
      p as "reddit" | "youtube" | "facebook" | "instagram",
      {
        body: parsed.body,
        subreddit: parsed.subreddit,
        title: parsed.title,
        linkUrl: parsed.linkUrl,
      },
    ),
    mediaUrls: [],
    status,
    scheduledAt,
    requestedApproverId,
    createdBy: session.userId,
  }));

  const inserted = await db
    .insert(socialPosts)
    .values(rows)
    .returning({ id: socialPosts.id });

  // Publish-now: execute immediately
  if (action === "publish" && !needsApproval) {
    for (const r of inserted) {
      try {
        await runPost(r.id);
      } catch {
        /* error stored on row */
      }
    }
  }

  revalidatePath("/social");
  revalidatePath("/social/calendar");
  revalidatePath("/social/planner");
  revalidatePath("/social/approvals");
  redirect("/social");
}

export async function duplicatePost(postId: string) {
  const session = await requireSessionWithCap("social.post.create");
  // Pull the post and its siblings if it was a group
  const [post] = await db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.id, postId),
        eq(socialPosts.workspaceId, session.workspaceId),
      ),
    );
  if (!post) throw new Error("Post not found");

  const siblings = post.groupId
    ? await db
        .select()
        .from(socialPosts)
        .where(
          and(
            eq(socialPosts.workspaceId, session.workspaceId),
            eq(socialPosts.groupId, post.groupId),
          ),
        )
    : [post];

  const newGroupId = siblings.length > 1 ? nanoid(12) : null;
  const inserted = await db
    .insert(socialPosts)
    .values(
      siblings.map((s) => ({
        workspaceId: session.workspaceId,
        groupId: newGroupId,
        platform: s.platform,
        body: s.body,
        mediaUrls: s.mediaUrls,
        status: "draft" as const,
        createdBy: session.userId,
      })),
    )
    .returning({ id: socialPosts.id });

  revalidatePath("/social");
  revalidatePath("/social/planner");
  return inserted[0]?.id;
}

export async function approvePost(args: {
  postId: string;
  action: "post_now" | "schedule";
  scheduledAt?: string;
}) {
  const session = await requireSessionWithCap("social.post.approve");
  const [post] = await db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.id, args.postId),
        eq(socialPosts.workspaceId, session.workspaceId),
      ),
    );
  if (!post) throw new Error("Post not found");
  if (post.status !== "pending_approval")
    throw new Error("Post is not awaiting approval");

  const isPostNow = args.action === "post_now";
  const scheduledAt = isPostNow
    ? new Date()
    : args.scheduledAt
      ? new Date(args.scheduledAt)
      : post.scheduledAt;

  await db
    .update(socialPosts)
    .set({
      status: "scheduled",
      approvedById: session.userId,
      approvedAt: new Date(),
      scheduledAt: scheduledAt,
    })
    .where(eq(socialPosts.id, post.id));

  // Execute immediately if "post_now"
  if (isPostNow) {
    try {
      await runPost(post.id);
    } catch {
      /* error stored on row */
    }
  }

  revalidatePath("/social");
  revalidatePath("/social/approvals");
  revalidatePath("/social/calendar");
  revalidatePath("/social/planner");
}

export async function rejectPost(postId: string, formData: FormData) {
  const session = await requireSessionWithCap("social.post.approve");
  const reason = (formData.get("reason") as string)?.trim() || "Rejected";
  await db
    .update(socialPosts)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectionReason: reason,
      approvedById: session.userId,
    })
    .where(
      and(
        eq(socialPosts.id, postId),
        eq(socialPosts.workspaceId, session.workspaceId),
      ),
    );
  revalidatePath("/social/approvals");
  revalidatePath("/social");
}

/**
 * Resubmit a draft or rejected post. Members can re-submit for approval;
 * owner/admin can directly schedule.
 */
export async function submitForApproval(
  postId: string,
  approverId?: string,
) {
  const session = await requireSessionWithCap("social.post.create");
  const settings = await getSettings(session.workspaceId);
  await db
    .update(socialPosts)
    .set({
      status: "pending_approval",
      requestedApproverId:
        approverId ?? settings?.defaultApproverId ?? null,
      rejectedAt: null,
      rejectionReason: null,
    })
    .where(
      and(
        eq(socialPosts.id, postId),
        eq(socialPosts.workspaceId, session.workspaceId),
      ),
    );
  revalidatePath("/social");
  revalidatePath("/social/approvals");
}

/* ─────────────────────── Run a post ─────────────────────── */

export async function runPost(postId: string): Promise<void> {
  const [post] = await db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.id, postId));
  if (!post) throw new Error("Post not found");
  if (post.status === "posted") return;
  if (post.status === "pending_approval" || post.status === "rejected") {
    throw new Error("Post is not approved");
  }

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
      .set({ status: "failed", error: (e as Error).message })
      .where(eq(socialPosts.id, post.id));
    throw e;
  }
}

export async function deletePost(postId: string) {
  const session = await requireSessionWithCap("social.post.create");
  // Also delete sibling group members if part of a group
  const [post] = await db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.id, postId),
        eq(socialPosts.workspaceId, session.workspaceId),
      ),
    );
  if (!post) return;

  if (post.groupId) {
    await db
      .delete(socialPosts)
      .where(
        and(
          eq(socialPosts.workspaceId, session.workspaceId),
          eq(socialPosts.groupId, post.groupId),
        ),
      );
  } else {
    await db
      .delete(socialPosts)
      .where(eq(socialPosts.id, postId));
  }
  revalidatePath("/social");
  revalidatePath("/social/planner");
  revalidatePath("/social/calendar");
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

/* ─────────────────────── Query helpers ─────────────────────── */

export type PostWithCreator = typeof socialPosts.$inferSelect & {
  creatorName: string | null;
  creatorEmail: string | null;
};

export async function listForApprover(approverUserId: string, workspaceId: string) {
  // Posts whose requested approver is this user, OR have no requested approver
  // and this user is allowed to approve (owner/admin).
  const rows = await db
    .select({
      post: socialPosts,
      creatorName: users.name,
      creatorEmail: users.email,
    })
    .from(socialPosts)
    .leftJoin(users, eq(users.id, socialPosts.createdBy))
    .where(
      and(
        eq(socialPosts.workspaceId, workspaceId),
        eq(socialPosts.status, "pending_approval"),
      ),
    );
  // Approver match: either the requested approver, or no one requested
  return rows.filter(
    (r) =>
      r.post.requestedApproverId === approverUserId ||
      r.post.requestedApproverId === null,
  );
}

