import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, workspaceSettings } from "@/lib/db/schema";
import { requireSession, requireSessionWithCap } from "@/lib/auth-helpers";
import { getSettings } from "@/lib/workspace-settings";
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

export default async function ApprovalsSettingsPage() {
  const session = await requireSession();
  const editable = can(session.role, "social.settings.edit");

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

  async function save(formData: FormData) {
    "use server";
    const s = await requireSessionWithCap("social.settings.edit");
    const require = formData.get("membersRequireApproval") === "on";
    const approverId = (formData.get("defaultApproverId") as string) || null;
    await db
      .insert(workspaceSettings)
      .values({
        workspaceId: s.workspaceId,
        membersRequireApproval: require,
        defaultApproverId: approverId,
      })
      .onConflictDoUpdate({
        target: workspaceSettings.workspaceId,
        set: {
          membersRequireApproval: require,
          defaultApproverId: approverId,
          updatedAt: new Date(),
        },
      });
    revalidatePath("/settings/approvals");
    revalidatePath("/social/new");
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Control whether members must get approval before publishing."
      />
      <div className="grid gap-6 p-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Social post approvals</CardTitle>
            <CardDescription>
              When enabled, anyone with the &quot;member&quot; role must submit
              posts for approval. Admins and the owner can always publish
              directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={save} className="flex flex-col gap-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="membersRequireApproval"
                  defaultChecked={settings?.membersRequireApproval ?? false}
                  disabled={!editable}
                  className="mt-1"
                />
                <span>
                  <div className="font-medium">
                    Members require approval before posting
                  </div>
                  <div className="text-xs text-zinc-500">
                    Members will only see &quot;Submit for approval&quot; on the
                    compose form.
                  </div>
                </span>
              </label>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor="defaultApproverId">
                  Default approver
                </label>
                <select
                  id="defaultApproverId"
                  name="defaultApproverId"
                  defaultValue={settings?.defaultApproverId ?? ""}
                  disabled={!editable}
                  className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="">— Any admin can approve —</option>
                  {approvers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name ?? a.email} ({a.role})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500">
                  When a member submits without picking someone, this person
                  gets notified.
                </p>
              </div>

              {editable ? (
                <div>
                  <Button type="submit">Save</Button>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Only owners and admins can change these settings.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How approval works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
            <ol className="ml-4 list-decimal space-y-2">
              <li>
                Member composes a post and clicks <strong>Submit for approval</strong>.
              </li>
              <li>
                The chosen approver (or the default) sees it in <a href="/social/approvals" className="underline">/social/approvals</a>.
              </li>
              <li>
                Approver clicks <strong>Approve & post now</strong> or{" "}
                <strong>Approve & schedule</strong> to publish, or{" "}
                <strong>Reject</strong> with a reason.
              </li>
              <li>
                On reject, the member sees the reason in <a href="/social" className="underline">/social</a> and can revise.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
