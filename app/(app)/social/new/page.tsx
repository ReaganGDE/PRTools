import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { getSettings } from "@/lib/workspace-settings";
import { PageHeader } from "@/components/page-header";
import { NewPostForm } from "./form";

export default async function NewSocialPostPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicate?: string }>;
}) {
  const session = await requireSession();
  const settings = await getSettings(session.workspaceId);

  const approvers = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.workspaceId, session.workspaceId),
        inArray(users.role, ["owner", "admin"]),
      ),
    );

  const memberNeedsApproval =
    session.role === "member" && !!settings?.membersRequireApproval;

  await searchParams; // accepted but not used here; the form reads from URL

  return (
    <>
      <PageHeader
        title="New social post"
        description="Compose to one or many platforms at once."
      />
      <div className="p-8">
        <NewPostForm
          memberNeedsApproval={memberNeedsApproval}
          approvers={approvers}
          defaultApproverId={settings?.defaultApproverId ?? null}
          canPublishDirectly={
            session.role === "owner" || session.role === "admin"
          }
        />
      </div>
    </>
  );
}
