import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 100;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; userId?: string }>;
}) {
  const session = await requireSessionWithCap("audit.view");
  const sp = await searchParams;
  const action = sp.action?.trim();
  const userIdFilter = sp.userId?.trim();

  const conds = [eq(auditLogs.workspaceId, session.workspaceId)];
  if (action) conds.push(eq(auditLogs.action, action));
  if (userIdFilter) conds.push(eq(auditLogs.userId, userIdFilter));

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt,
      actorEmail: users.email,
      actorName: users.name,
      actorId: users.id,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(...conds))
    .orderBy(desc(auditLogs.createdAt))
    .limit(PAGE_SIZE);

  const members = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.workspaceId, session.workspaceId));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every consequential write action in this workspace."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">Back to settings</Link>
          </Button>
        }
      />
      <div className="space-y-4 p-8">
        <form className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-500">Action</label>
            <input
              type="search"
              name="action"
              defaultValue={action ?? ""}
              placeholder="e.g. email.campaign.send"
              className="h-9 w-64 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-500">User</label>
            <select
              name="userId"
              defaultValue={userIdFilter ?? ""}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">Anyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {(action || userIdFilter) ? (
            <Button asChild variant="ghost">
              <Link href="/settings/audit">Reset</Link>
            </Button>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              No audit events match those filters.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 align-top last:border-0 dark:border-zinc-900"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-zinc-500">
                      {r.createdAt.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {r.actorName ?? r.actorEmail ?? (
                        <span className="text-zinc-400">system</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      {r.action}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500">
                      {r.targetType ? (
                        <>
                          {r.targetType}
                          {r.targetId ? (
                            <span className="text-zinc-400">
                              :{r.targetId.slice(0, 8)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500">
                      {r.meta ? (
                        <code className="break-all">
                          {JSON.stringify(r.meta)}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-zinc-500">
              Showing {rows.length} of {PAGE_SIZE} max per page.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
