import Link from "next/link";
import { eq, and, inArray } from "drizzle-orm";
import { Plus, Link2, KeyRound, FileText, Users, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import {
  resourceGroups,
  resourceGroupMembers,
  resources,
  resourceGroupAssignments,
  resourceUserAssignments,
  users,
} from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  createResource,
  updateResource,
  deleteResource,
} from "./actions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_META = {
  link: { label: "Link", icon: Link2, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400" },
  credential: { label: "Credential", icon: KeyRound, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400" },
  document: { label: "Document", icon: FileText, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" },
} as const;

function TypeBadge({ type }: { type: "link" | "credential" | "document" }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ResourcesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSessionWithCap("resources.admin");
  const params = await searchParams;
  const tab = (params.tab as string | undefined) ?? "resources";

  // Load all data in parallel
  const [groupList, resourceList, workspaceUsers, groupMemberRows, groupAssignRows, userAssignRows] =
    await Promise.all([
      db
        .select()
        .from(resourceGroups)
        .where(eq(resourceGroups.workspaceId, session.workspaceId))
        .orderBy(resourceGroups.name),
      db
        .select()
        .from(resources)
        .where(eq(resources.workspaceId, session.workspaceId))
        .orderBy(resources.title),
      db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.workspaceId, session.workspaceId))
        .orderBy(users.name),
      db.select().from(resourceGroupMembers),
      db.select().from(resourceGroupAssignments),
      db.select().from(resourceUserAssignments),
    ]);

  // Build lookup maps
  const membersByGroup = new Map<string, string[]>();
  for (const row of groupMemberRows) {
    const arr = membersByGroup.get(row.groupId) ?? [];
    arr.push(row.userId);
    membersByGroup.set(row.groupId, arr);
  }

  const groupIdsByResource = new Map<string, string[]>();
  for (const row of groupAssignRows) {
    const arr = groupIdsByResource.get(row.resourceId) ?? [];
    arr.push(row.groupId);
    groupIdsByResource.set(row.resourceId, arr);
  }

  const userIdsByResource = new Map<string, string[]>();
  for (const row of userAssignRows) {
    const arr = userIdsByResource.get(row.resourceId) ?? [];
    arr.push(row.userId);
    userIdsByResource.set(row.resourceId, arr);
  }

  const userById = new Map(workspaceUsers.map((u) => [u.id, u]));

  return (
    <>
      <PageHeader
        title="Resources"
        description="Manage links, credentials, and documents shared with your team."
      />

      {/* Tab bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-4xl gap-0 px-8">
          {(["resources", "groups"] as const).map((t) => (
            <Link
              key={t}
              href={`?tab=${t}`}
              className={[
                "border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors",
                tab === t
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
              ].join(" ")}
            >
              {t === "resources" ? "Resources" : "Groups"}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-8">
        {tab === "resources" && (
          <>
            {/* Existing resources */}
            <div className="space-y-4">
              {resourceList.map((r) => {
                const assignedGroupIds = groupIdsByResource.get(r.id) ?? [];
                const assignedUserIds = userIdsByResource.get(r.id) ?? [];
                const updateAction = updateResource.bind(null, r.id);
                const deleteAction = deleteResource.bind(null, r.id);

                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
                  >
                    <form action={updateAction} className="p-5">
                      {/* Header row */}
                      <div className="mb-4 flex items-center gap-2">
                        <TypeBadge type={r.type} />
                        <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {r.title}
                        </span>
                      </div>

                      {/* Type selector */}
                      <div className="mb-4 grid gap-1.5">
                        <Label htmlFor={`type-${r.id}`}>Type</Label>
                        <select
                          id={`type-${r.id}`}
                          name="type"
                          defaultValue={r.type}
                          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="link">Link</option>
                          <option value="credential">Credential</option>
                          <option value="document">Document</option>
                        </select>
                      </div>

                      {/* Core fields */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label htmlFor={`title-${r.id}`}>Title</Label>
                          <Input
                            id={`title-${r.id}`}
                            name="title"
                            defaultValue={r.title}
                            required
                          />
                        </div>
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label htmlFor={`desc-${r.id}`}>Description</Label>
                          <Input
                            id={`desc-${r.id}`}
                            name="description"
                            defaultValue={r.description ?? ""}
                            placeholder="Optional description"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`url-${r.id}`}>URL</Label>
                          <Input
                            id={`url-${r.id}`}
                            name="url"
                            type="url"
                            defaultValue={r.url ?? ""}
                            placeholder="https://"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`exturl-${r.id}`}>External URL</Label>
                          <Input
                            id={`exturl-${r.id}`}
                            name="externalUrl"
                            type="url"
                            defaultValue={r.externalUrl ?? ""}
                            placeholder="https://"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`user-${r.id}`}>Username</Label>
                          <Input
                            id={`user-${r.id}`}
                            name="username"
                            defaultValue={r.username ?? ""}
                            placeholder="username or email"
                            autoComplete="off"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`pass-${r.id}`}>
                            Password
                            <span className="ml-1 text-xs font-normal text-zinc-400">
                              (stored securely)
                            </span>
                          </Label>
                          <Input
                            id={`pass-${r.id}`}
                            name="password"
                            type="password"
                            defaultValue={r.password ?? ""}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>

                      {/* Assignments */}
                      <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
                        <p className="mb-3 text-sm font-medium">Assign to groups</p>
                        {groupList.length === 0 ? (
                          <p className="text-xs text-zinc-400">No groups yet — create one in the Groups tab.</p>
                        ) : (
                          <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {groupList.map((g) => (
                              <label key={g.id} className="flex items-center gap-1.5 text-sm">
                                <input
                                  type="checkbox"
                                  name="groupIds"
                                  value={g.id}
                                  defaultChecked={assignedGroupIds.includes(g.id)}
                                  className="rounded accent-indigo-600"
                                />
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: g.color }}
                                />
                                {g.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <p className="mb-3 text-sm font-medium">Assign to users</p>
                        {workspaceUsers.length === 0 ? (
                          <p className="text-xs text-zinc-400">No users in workspace.</p>
                        ) : (
                          <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {workspaceUsers.map((u) => (
                              <label key={u.id} className="flex items-center gap-1.5 text-sm">
                                <input
                                  type="checkbox"
                                  name="userIds"
                                  value={u.id}
                                  defaultChecked={assignedUserIds.includes(u.id)}
                                  className="rounded accent-indigo-600"
                                />
                                {u.name ?? u.email}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
                        <Button
                          type="submit"
                          formAction={deleteAction}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                        <Button type="submit" variant="outline" size="sm">
                          Save changes
                        </Button>
                      </div>
                    </form>
                  </div>
                );
              })}
            </div>

            {/* Create resource form */}
            <form
              action={createResource}
              className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Plus className="h-4 w-4" /> Add a resource
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="new-res-type">Type</Label>
                  <select
                    id="new-res-type"
                    name="type"
                    defaultValue="link"
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="link">Link</option>
                    <option value="credential">Credential</option>
                    <option value="document">Document</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-res-title">Title</Label>
                  <Input id="new-res-title" name="title" required placeholder="Resource title" />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-res-desc">Description</Label>
                  <Input
                    id="new-res-desc"
                    name="description"
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-res-url">URL</Label>
                  <Input
                    id="new-res-url"
                    name="url"
                    type="url"
                    placeholder="https://"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-res-exturl">External URL</Label>
                  <Input
                    id="new-res-exturl"
                    name="externalUrl"
                    type="url"
                    placeholder="https://"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-res-username">Username</Label>
                  <Input
                    id="new-res-username"
                    name="username"
                    placeholder="username or email"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-res-password">
                    Password
                    <span className="ml-1 text-xs font-normal text-zinc-400">
                      (stored securely)
                    </span>
                  </Label>
                  <Input
                    id="new-res-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {groupList.length > 0 && (
                <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
                  <p className="mb-3 text-sm font-medium">Assign to groups</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {groupList.map((g) => (
                      <label key={g.id} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          name="groupIds"
                          value={g.id}
                          className="rounded accent-indigo-600"
                        />
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: g.color }}
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {workspaceUsers.length > 0 && (
                <div className="mt-4">
                  <p className="mb-3 text-sm font-medium">Assign to users</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {workspaceUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          name="userIds"
                          value={u.id}
                          className="rounded accent-indigo-600"
                        />
                        {u.name ?? u.email}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button type="submit">Add resource</Button>
              </div>
            </form>
          </>
        )}

        {tab === "groups" && (
          <>
            {/* Existing groups */}
            <div className="space-y-4">
              {groupList.map((g) => {
                const memberIds = membersByGroup.get(g.id) ?? [];
                const members = memberIds.map((id) => userById.get(id)).filter(Boolean) as {
                  id: string;
                  name: string | null;
                  email: string;
                }[];
                const nonMembers = workspaceUsers.filter((u) => !memberIds.includes(u.id));
                const updateAction = updateGroup.bind(null, g.id);
                const deleteAction = deleteGroup.bind(null, g.id);
                const addMemberAction = addGroupMember.bind(null, g.id);

                return (
                  <div
                    key={g.id}
                    className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
                    style={{ borderLeftWidth: 3, borderLeftColor: g.color }}
                  >
                    {/* Edit form */}
                    <form action={updateAction} className="p-5">
                      <div className="flex flex-wrap items-end gap-3">
                        <span
                          className="h-9 w-9 shrink-0 rounded-lg shadow-sm"
                          style={{ backgroundColor: g.color }}
                        />
                        <div className="grid flex-1 gap-1.5" style={{ minWidth: 180 }}>
                          <Label htmlFor={`gname-${g.id}`}>Name</Label>
                          <Input
                            id={`gname-${g.id}`}
                            name="name"
                            defaultValue={g.name}
                            required
                          />
                        </div>
                        <div className="grid flex-1 gap-1.5" style={{ minWidth: 220 }}>
                          <Label htmlFor={`gdesc-${g.id}`}>Description</Label>
                          <Input
                            id={`gdesc-${g.id}`}
                            name="description"
                            defaultValue={g.description ?? ""}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`gcolor-${g.id}`}>Color</Label>
                          <input
                            id={`gcolor-${g.id}`}
                            name="color"
                            type="color"
                            defaultValue={g.color}
                            className="h-9 w-16 cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          type="submit"
                          formAction={deleteAction}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete group
                        </Button>
                        <Button type="submit" variant="outline" size="sm">
                          Save changes
                        </Button>
                      </div>
                    </form>

                    {/* Members section */}
                    <div className="border-t border-zinc-100 px-5 pb-5 pt-4 dark:border-zinc-800/60">
                      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
                        <Users className="h-3.5 w-3.5 text-zinc-400" />
                        Members ({members.length})
                      </div>

                      {members.length > 0 ? (
                        <ul className="mb-4 space-y-1.5">
                          {members.map((u) => {
                            const removeMemberAction = removeGroupMember.bind(null, g.id, u.id);
                            return (
                              <li key={u.id} className="flex items-center justify-between gap-2">
                                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                  {u.name ?? u.email}
                                  {u.name && (
                                    <span className="ml-1.5 text-xs text-zinc-400">{u.email}</span>
                                  )}
                                </span>
                                <form action={removeMemberAction}>
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-zinc-400 hover:text-red-500"
                                  >
                                    Remove
                                  </Button>
                                </form>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mb-4 text-xs text-zinc-400">No members yet.</p>
                      )}

                      {nonMembers.length > 0 && (
                        <form action={addMemberAction} className="flex items-end gap-2">
                          <div className="grid flex-1 gap-1.5">
                            <Label htmlFor={`add-member-${g.id}`} className="text-xs">
                              Add member
                            </Label>
                            <select
                              id={`add-member-${g.id}`}
                              name="userId"
                              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              {nonMembers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name ?? u.email}
                                  {u.name ? ` (${u.email})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Button type="submit" variant="outline" size="sm">
                            Add
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create group form */}
            <form
              action={createGroup}
              className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Plus className="h-4 w-4" /> Add a group
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                <div className="grid gap-1.5">
                  <Label htmlFor="new-group-name">Name</Label>
                  <Input
                    id="new-group-name"
                    name="name"
                    required
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-group-desc">Description</Label>
                  <Input
                    id="new-group-desc"
                    name="description"
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-group-color">Color</Label>
                  <input
                    id="new-group-color"
                    name="color"
                    type="color"
                    defaultValue="#6366f1"
                    className="h-9 w-16 cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700"
                  />
                </div>
                <Button type="submit" className="self-end">
                  Add group
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
