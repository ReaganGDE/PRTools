import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { listInvites } from "@/lib/invites";
import { requireSession } from "@/lib/auth-helpers";
import { InviteLink } from "./invite-link";
import {
  can,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  CAPABILITIES,
  type Role,
} from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  sendInvite,
  revokePendingInvite,
  changeRole,
  changeToolAccess,
  removeMember,
  transferOwnership,
} from "./actions";

export default async function TeamPage() {
  const session = await requireSession();
  const wsId = session.workspaceId;

  const members = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      toolAccess: users.toolAccess,
    })
    .from(users)
    .where(eq(users.workspaceId, wsId))
    .orderBy(desc(users.createdAt));

  const invites = await listInvites(wsId);
  const pending = invites.filter((i) => !i.acceptedAt);

  const baseUrl =
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const canInvite = can(session.role, "team.invite");
  const canChangeRole = can(session.role, "team.role.change");
  const canRemove = can(session.role, "team.remove");

  return (
    <>
      <PageHeader
        title="Team & permissions"
        description="Invite teammates and control what they can do."
      />
      <div className="grid gap-6 p-8 lg:grid-cols-3">
        {/* Members ─────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Members ({members.length})</CardTitle>
            <CardDescription>
              {canChangeRole
                ? "Change someone's role or remove them from the workspace."
                : "Read-only — only the workspace owner can change roles."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {members.map((m) => {
                const isSelf = m.id === session.userId;
                const isOwner = m.role === "owner";
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {m.name ?? m.email}
                        {isSelf ? (
                          <span className="ml-2 text-xs text-zinc-400">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-zinc-500">
                        {m.email}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Role display / edit */}
                      {canChangeRole && !isOwner && !isSelf ? (
                        <form
                          action={changeRole.bind(null, m.id)}
                          className="flex items-center gap-1"
                        >
                          <select
                            name="role"
                            defaultValue={m.role}
                            className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <Button type="submit" size="sm" variant="outline">
                            Save
                          </Button>
                        </form>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}

                      {/* Tool access */}
                      {canChangeRole && !isOwner && !isSelf ? (
                        <form
                          action={changeToolAccess.bind(null, m.id)}
                          className="flex items-center gap-1"
                        >
                          <select
                            name="toolAccess"
                            defaultValue={m.toolAccess}
                            className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            <option value="all">All tools</option>
                            <option value="pr_only">PR only</option>
                            <option value="social_only">Social only</option>
                          </select>
                          <Button type="submit" size="sm" variant="outline">
                            Save
                          </Button>
                        </form>
                      ) : (
                        <ToolAccessBadge access={m.toolAccess} />
                      )}

                      {/* Transfer ownership */}
                      {session.role === "owner" && !isSelf && !isOwner ? (
                        <form action={transferOwnership.bind(null, m.id)}>
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            title="Transfer ownership"
                          >
                            ↑ Owner
                          </Button>
                        </form>
                      ) : null}

                      {/* Remove */}
                      {canRemove && !isSelf && !isOwner ? (
                        <form action={removeMember.bind(null, m.id)}>
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Invite ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
            <CardDescription>
              They&apos;ll get an email — or copy the invite link below and send
              it yourself.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canInvite ? (
              <form action={sendInvite} className="flex flex-col gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    required
                    placeholder="teammate@company.com"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <select
                    id="invite-role"
                    name="role"
                    defaultValue="member"
                    className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-tool-access">Tool access</Label>
                  <select
                    id="invite-tool-access"
                    name="toolAccess"
                    defaultValue="all"
                    className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="all">All tools</option>
                    <option value="pr_only">PR only</option>
                    <option value="social_only">Social only</option>
                  </select>
                </div>
                <Button type="submit">Send invite</Button>
              </form>
            ) : (
              <p className="text-sm text-zinc-500">
                Your role doesn&apos;t allow inviting. Ask an admin or owner.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending invites ─────────────────────────────────── */}
        {pending.length > 0 ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Pending invites ({pending.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-zinc-500">
                If the invite email doesn&apos;t arrive (common while the
                sending domain is still unverified in Resend), use{" "}
                <strong>Copy link</strong> and send it to the person directly.
                They&apos;ll sign in and land in this workspace.
              </p>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pending.map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div>
                      <span>{i.email}</span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {i.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">
                        expires {i.expiresAt.toLocaleDateString()}
                      </span>
                      {canInvite ? (
                        <InviteLink url={`${baseUrl}/invite/${i.token}`} />
                      ) : null}
                      {canInvite ? (
                        <form action={revokePendingInvite.bind(null, i.id)}>
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                          >
                            Revoke
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* Permissions reference ────────────────────────────── */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>What each role can do</CardTitle>
            <CardDescription>
              Capabilities are checked on every server action.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-4">
              {(["owner", "admin", "member", "viewer"] as Role[]).map((r) => (
                <div key={r} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="mb-1 flex items-center gap-2">
                    <RoleBadge role={r} />
                  </div>
                  <p className="text-xs text-zinc-500">
                    {ROLE_DESCRIPTIONS[r]}
                  </p>
                </div>
              ))}
            </div>
            <details className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
              <summary className="cursor-pointer">
                Full capability matrix
              </summary>
              <table className="mt-3 w-full text-xs">
                <thead className="border-b border-zinc-200 text-left dark:border-zinc-800">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Capability</th>
                    <th className="py-1 pr-2 text-center font-medium">Owner</th>
                    <th className="py-1 pr-2 text-center font-medium">Admin</th>
                    <th className="py-1 pr-2 text-center font-medium">Member</th>
                    <th className="py-1 pr-2 text-center font-medium">Viewer</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(CAPABILITIES).map(([cap, roles]) => (
                    <tr
                      key={cap}
                      className="border-b border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-1 pr-3 font-mono">{cap}</td>
                      {(["owner", "admin", "member", "viewer"] as Role[]).map(
                        (r) => (
                          <td key={r} className="py-1 pr-2 text-center">
                            {(roles as readonly string[]).includes(r) ? "✓" : "—"}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

type ToolAccess = "all" | "pr_only" | "social_only";

function ToolAccessBadge({ access }: { access: ToolAccess }) {
  const label =
    access === "pr_only" ? "PR only" : access === "social_only" ? "Social only" : "All tools";
  const cls =
    access === "pr_only"
      ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
      : access === "social_only"
        ? "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const cls =
    role === "owner"
      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
      : role === "admin"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
        : role === "member"
          ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}
