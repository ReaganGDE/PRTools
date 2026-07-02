import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import {
  users,
  departments,
  resources,
  resourceDepartments,
  type Department,
  type Resource,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { can } from "@/lib/permissions";
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
import { createResource, updateResource, deleteResource } from "./actions";
import { SecretCell } from "./secret-cell";

export default async function ResourcesPage() {
  const session = await requireSession();
  const wsId = session.workspaceId;

  const canReveal = can(session.role, "resources.reveal");
  const canManage = can(session.role, "resources.manage");

  const [me] = await db
    .select({ departmentId: users.departmentId })
    .from(users)
    .where(eq(users.id, session.userId));

  const depts = await db
    .select()
    .from(departments)
    .where(eq(departments.workspaceId, wsId))
    .orderBy(asc(departments.name));

  const allResources = await db
    .select()
    .from(resources)
    .where(eq(resources.workspaceId, wsId))
    .orderBy(asc(resources.name));

  const tagRows = await db
    .select({
      resourceId: resourceDepartments.resourceId,
      departmentId: resourceDepartments.departmentId,
    })
    .from(resourceDepartments)
    .innerJoin(resources, eq(resourceDepartments.resourceId, resources.id))
    .where(eq(resources.workspaceId, wsId));

  const deptsByResource = new Map<string, string[]>();
  for (const t of tagRows) {
    const list = deptsByResource.get(t.resourceId) ?? [];
    list.push(t.departmentId);
    deptsByResource.set(t.resourceId, list);
  }

  const byDept = new Map<string, Resource[]>();
  const general: Resource[] = [];
  for (const r of allResources) {
    const tagged = deptsByResource.get(r.id);
    if (!tagged || tagged.length === 0) {
      general.push(r);
      continue;
    }
    for (const deptId of tagged) {
      const list = byDept.get(deptId) ?? [];
      list.push(r);
      byDept.set(deptId, list);
    }
  }

  // The signed-in user's department comes first, then general resources,
  // then everyone else's departments alphabetically.
  const myDept = depts.find((d) => d.id === me?.departmentId) ?? null;
  const otherDepts = depts.filter((d) => d.id !== myDept?.id);

  const sections: { title: string; subtitle?: string; items: Resource[] }[] = [];
  if (myDept) {
    sections.push({
      title: myDept.name,
      subtitle: "Your department",
      items: byDept.get(myDept.id) ?? [],
    });
  }
  if (general.length > 0 || depts.length === 0) {
    sections.push({ title: "General", subtitle: "Everyone", items: general });
  }
  for (const d of otherDepts) {
    const items = byDept.get(d.id) ?? [];
    if (items.length > 0 || canManage) {
      sections.push({ title: d.name, items });
    }
  }

  const deptNames = new Map(depts.map((d) => [d.id, d.name]));

  return (
    <>
      <PageHeader
        title="Resources"
        description="Shared website logins and links, organized by department."
      />
      <div className="flex flex-col gap-6 p-8">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>
                {section.title}
                {section.subtitle ? (
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {section.subtitle}
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {section.items.length === 0 ? (
                <p className="text-sm text-zinc-500">No resources yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {section.items.map((r) => (
                    <ResourceRow
                      key={r.id}
                      resource={r}
                      canReveal={canReveal}
                      canManage={canManage}
                      allDepts={depts}
                      taggedDeptIds={deptsByResource.get(r.id) ?? []}
                      deptNames={deptNames}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Add a resource</CardTitle>
              <CardDescription>
                Passwords are stored encrypted and only shown on click.
                {depts.length === 0 ? (
                  <>
                    {" "}
                    To organize by department, first create departments in{" "}
                    <Link href="/settings/team" className="underline">
                      Team settings
                    </Link>
                    .
                  </>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createResource} className="flex max-w-lg flex-col gap-3">
                <ResourceFields depts={depts} />
                <Button type="submit" className="self-start">
                  Add resource
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function ResourceRow({
  resource,
  canReveal,
  canManage,
  allDepts,
  taggedDeptIds,
  deptNames,
}: {
  resource: Resource;
  canReveal: boolean;
  canManage: boolean;
  allDepts: Department[];
  taggedDeptIds: string[];
  deptNames: Map<string, string>;
}) {
  let host = resource.url;
  try {
    host = new URL(resource.url).hostname.replace(/^www\./, "");
  } catch {
    // keep raw url
  }
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="min-w-0 flex-1">
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium hover:underline"
          >
            {resource.name}
            <ExternalLink className="h-3 w-3 text-zinc-400" />
          </a>
          <span className="ml-2 text-xs text-zinc-500">{host}</span>
          {taggedDeptIds.length > 0 ? (
            <span className="ml-2 space-x-1">
              {taggedDeptIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {deptNames.get(id)}
                </span>
              ))}
            </span>
          ) : null}
          {resource.notes ? (
            <p className="mt-0.5 text-xs text-zinc-500">{resource.notes}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          {resource.username ? (
            <span className="text-xs text-zinc-600 dark:text-zinc-300">
              <span className="text-zinc-400">user&nbsp;</span>
              <span className="font-mono">{resource.username}</span>
            </span>
          ) : null}
          {resource.passwordEncrypted ? (
            <span className="text-xs">
              <span className="text-zinc-400">pass&nbsp;</span>
              <SecretCell resourceId={resource.id} canReveal={canReveal} />
            </span>
          ) : null}
          {canManage ? (
            <form action={deleteResource.bind(null, resource.id)}>
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
              >
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Edit
          </summary>
          <form
            action={updateResource.bind(null, resource.id)}
            className="mt-3 flex max-w-lg flex-col gap-3 rounded-md border border-zinc-100 p-4 dark:border-zinc-800"
          >
            <ResourceFields
              depts={allDepts}
              defaults={resource}
              taggedDeptIds={taggedDeptIds}
            />
            <Button type="submit" size="sm" className="self-start">
              Save changes
            </Button>
          </form>
        </details>
      ) : null}
    </li>
  );
}

function ResourceFields({
  depts,
  defaults,
  taggedDeptIds = [],
}: {
  depts: Department[];
  defaults?: Resource;
  taggedDeptIds?: string[];
}) {
  const uid = defaults?.id ?? "new";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`name-${uid}`}>Name</Label>
          <Input
            id={`name-${uid}`}
            name="name"
            required
            defaultValue={defaults?.name}
            placeholder="Canva"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`url-${uid}`}>URL</Label>
          <Input
            id={`url-${uid}`}
            name="url"
            required
            defaultValue={defaults?.url}
            placeholder="canva.com"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`username-${uid}`}>Username / email</Label>
          <Input
            id={`username-${uid}`}
            name="username"
            defaultValue={defaults?.username ?? ""}
            placeholder="team@company.com"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`password-${uid}`}>Password</Label>
          <Input
            id={`password-${uid}`}
            name="password"
            type="password"
            autoComplete="off"
            placeholder={
              defaults?.passwordEncrypted ? "(unchanged)" : "optional"
            }
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`notes-${uid}`}>Notes</Label>
        <Input
          id={`notes-${uid}`}
          name="notes"
          defaultValue={defaults?.notes ?? ""}
          placeholder="e.g. 2FA codes go to the shared phone"
        />
      </div>
      {depts.length > 0 ? (
        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-medium">
            Useful for which departments?
          </legend>
          <p className="text-xs text-zinc-500">
            Leave all unchecked to file it under General (everyone).
          </p>
          <div className="mt-1 flex flex-wrap gap-3">
            {depts.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <input
                  type="checkbox"
                  name="departments"
                  value={d.id}
                  defaultChecked={taggedDeptIds.includes(d.id)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
