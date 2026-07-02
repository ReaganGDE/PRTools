import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialPosts, users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { approvePost, rejectPost } from "../actions";

export default async function ApprovalsPage() {
  const session = await requireSession();
  if (!can(session.role, "social.post.approve")) {
    return (
      <>
        <PageHeader
          title="Approvals"
          description="Pending social posts awaiting review."
        />
        <div className="p-8">
          <Card>
            <CardContent className="p-8 text-center text-sm text-zinc-500">
              Only admins and the owner can approve posts.
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Posts assigned to me OR with no specific approver
  const rows = await db
    .select({
      post: socialPosts,
      creator: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(socialPosts)
    .leftJoin(users, eq(users.id, socialPosts.createdBy))
    .where(
      and(
        eq(socialPosts.workspaceId, session.workspaceId),
        eq(socialPosts.status, "pending_approval"),
      ),
    )
    .orderBy(desc(socialPosts.createdAt));

  const mine = rows.filter(
    (r) =>
      r.post.requestedApproverId === session.userId ||
      r.post.requestedApproverId === null,
  );
  const elsewhere = rows.filter(
    (r) =>
      r.post.requestedApproverId !== session.userId &&
      r.post.requestedApproverId !== null,
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        description={`${mine.length} pending for you, ${elsewhere.length} for other reviewers.`}
      />
      <div className="p-8">
        {mine.length === 0 && elsewhere.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">Nothing awaiting approval.</p>
          </div>
        ) : null}

        {mine.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
              Awaiting your review
            </h2>
            <ul className="space-y-3">
              {mine.map((r) => (
                <ApprovalCard key={r.post.id} row={r} />
              ))}
            </ul>
          </section>
        ) : null}

        {elsewhere.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
              Assigned to other reviewers
            </h2>
            <ul className="space-y-3">
              {elsewhere.map((r) => (
                <ApprovalCard key={r.post.id} row={r} dim />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function ApprovalCard({
  row,
  dim = false,
}: {
  row: {
    post: typeof socialPosts.$inferSelect;
    creator: { id: string | null; name: string | null; email: string | null } | null;
  };
  dim?: boolean;
}) {
  const p = row.post;
  let title = "";
  let body = p.body;
  if (p.platform === "reddit") {
    try {
      const meta = JSON.parse(p.body) as { title?: string; body?: string };
      title = meta.title ?? "";
      body = meta.body ?? "";
    } catch {
      /* keep raw */
    }
  }
  const approveNow = async () => {
    "use server";
    await approvePost({ postId: p.id, action: "post_now" });
  };
  const approveScheduled = async (formData: FormData) => {
    "use server";
    const at = (formData.get("scheduledAt") as string) || undefined;
    await approvePost({ postId: p.id, action: "schedule", scheduledAt: at });
  };
  return (
    <Card className={dim ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 capitalize dark:bg-zinc-800">
            {p.platform}
          </span>
          <span>
            By {row.creator?.name ?? row.creator?.email ?? "unknown"}
          </span>
          <span>·</span>
          <span>{p.createdAt.toLocaleString()}</span>
          {p.scheduledAt ? (
            <>
              <span>·</span>
              <span>Wants to schedule {p.scheduledAt.toLocaleString()}</span>
            </>
          ) : null}
        </div>
        {title ? (
          <CardTitle className="text-base">{title}</CardTitle>
        ) : null}
        <CardDescription className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {body}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <form action={approveNow}>
            <Button type="submit" size="sm">
              Approve &amp; post now
            </Button>
          </form>
          <form action={approveScheduled} className="flex items-center gap-1">
            <input
              type="datetime-local"
              name="scheduledAt"
              defaultValue={
                p.scheduledAt
                  ? new Date(
                      p.scheduledAt.getTime() -
                        p.scheduledAt.getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            />
            <Button type="submit" size="sm" variant="outline">
              Approve &amp; schedule
            </Button>
          </form>
          <details className="text-sm">
            <summary className="cursor-pointer rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Reject…
            </summary>
            <form
              action={rejectPost.bind(null, p.id)}
              className="mt-2 flex items-center gap-2"
            >
              <input
                type="text"
                name="reason"
                required
                placeholder="Why are you rejecting?"
                className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
              />
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
              >
                Reject
              </Button>
            </form>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
