import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { Link2, KeyRound, FileText, ExternalLink, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import {
  resources,
  resourceGroupMembers,
  resourceGroupAssignments,
  resourceUserAssignments,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { createPersonalResource, deletePersonalResource } from "./actions";

type Resource = typeof resources.$inferSelect;

export default async function ResourcesPage() {
  const session = await requireSession();

  const [myGroupMemberships, userAssignments, allResources] = await Promise.all([
    db
      .select()
      .from(resourceGroupMembers)
      .where(eq(resourceGroupMembers.userId, session.userId)),
    db
      .select()
      .from(resourceUserAssignments)
      .where(eq(resourceUserAssignments.userId, session.userId)),
    db
      .select()
      .from(resources)
      .where(eq(resources.workspaceId, session.workspaceId)),
  ]);

  const myGroupIds = new Set(myGroupMemberships.map((m) => m.groupId));

  // Load group assignments for the groups this user belongs to
  let groupAssignedResourceIds = new Set<string>();
  if (myGroupIds.size > 0) {
    const groupAssignments = await db
      .select()
      .from(resourceGroupAssignments);
    groupAssignedResourceIds = new Set(
      groupAssignments
        .filter((a) => myGroupIds.has(a.groupId))
        .map((a) => a.resourceId),
    );
  }

  const directAssignedResourceIds = new Set(
    userAssignments.map((a) => a.resourceId),
  );

  // Filter: visible if personal+mine OR directly assigned OR group-assigned
  const visible = allResources.filter((r) => {
    if (r.isPersonal && r.createdBy === session.userId) return true;
    if (directAssignedResourceIds.has(r.id)) return true;
    if (groupAssignedResourceIds.has(r.id)) return true;
    return false;
  });

  const links = visible.filter((r) => r.type === "link" && !r.isPersonal);
  const credentials = visible.filter((r) => r.type === "credential" && !r.isPersonal);
  const documents = visible.filter((r) => r.type === "document" && !r.isPersonal);
  const myItems = visible.filter((r) => r.isPersonal && r.createdBy === session.userId);

  return (
    <>
      <PageHeader
        title="Resources"
        description="Links, credentials, and documents shared with you."
      />
      <div className="mx-auto max-w-4xl space-y-8 p-8">
        {links.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
              Links
            </h2>
            <div className="space-y-3">
              {links.map((r) => (
                <LinkCard key={r.id} resource={r} />
              ))}
            </div>
          </section>
        )}

        {credentials.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
              Credentials
            </h2>
            <p className="mb-3 text-xs text-zinc-400">
              Passwords are only visible to users with access to this item.
            </p>
            <div className="space-y-3">
              {credentials.map((r) => (
                <CredentialCard key={r.id} resource={r} />
              ))}
            </div>
          </section>
        )}

        {documents.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
              Documents
            </h2>
            <div className="space-y-3">
              {documents.map((r) => (
                <DocumentCard key={r.id} resource={r} />
              ))}
            </div>
          </section>
        )}

        {myItems.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
              My Items
            </h2>
            <div className="space-y-3">
              {myItems.map((r) => (
                <PersonalItemCard key={r.id} resource={r} />
              ))}
            </div>
          </section>
        )}

        {/* Add personal item form */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Add personal item
          </h2>
          <div className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
            <form action={createPersonalResource} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="type"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    required
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                  >
                    <option value="link">Link</option>
                    <option value="credential">Credential</option>
                    <option value="document">Document</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="title"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    Title
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    placeholder="e.g. Company Drive"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="description"
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Description (optional)
                </label>
                <input
                  id="description"
                  name="description"
                  type="text"
                  placeholder="Short description"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="url"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    URL (optional)
                  </label>
                  <input
                    id="url"
                    name="url"
                    type="url"
                    placeholder="https://..."
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="username"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    Username (optional)
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="user@example.com"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Password (optional)
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  <Plus className="h-4 w-4" />
                  Add item
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Empty state if nothing at all */}
        {visible.length === 0 && myItems.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-16 text-center dark:border-zinc-700 dark:bg-zinc-900/20">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold">No resources yet</h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              Resources shared with you will appear here. Use the form below to
              add your own personal items.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
      {children}
    </div>
  );
}

function LinkCard({ resource: r }: { resource: Resource }) {
  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400">
          <Link2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{r.title}</p>
          {r.description && (
            <p className="mt-0.5 text-sm text-zinc-500">{r.description}</p>
          )}
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {r.url}
            </a>
          )}
        </div>
      </div>
    </CardShell>
  );
}

function CredentialCard({ resource: r }: { resource: Resource }) {
  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{r.title}</p>
          {r.description && (
            <p className="text-sm text-zinc-500">{r.description}</p>
          )}
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {r.url}
            </a>
          )}
          {r.username && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
              <span className="text-xs font-medium text-zinc-500 w-20 shrink-0">Username</span>
              <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{r.username}</span>
            </div>
          )}
          {r.password && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
              <span className="text-xs font-medium text-zinc-500 w-20 shrink-0">Password</span>
              <span className="font-mono text-sm tracking-widest text-zinc-500">{"•".repeat(Math.min(r.password.length, 12))}</span>
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

function DocumentCard({ resource: r }: { resource: Resource }) {
  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{r.title}</p>
          {r.description && (
            <p className="mt-0.5 text-sm text-zinc-500">{r.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            {r.fileUrl && (
              <a
                href={r.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 underline dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                <FileText className="h-3.5 w-3.5" />
                Download
                {r.fileName && (
                  <span className="text-zinc-400 font-normal">({r.fileName})</span>
                )}
              </a>
            )}
            {r.externalUrl && (
              <a
                href={r.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function PersonalItemCard({ resource: r }: { resource: Resource }) {
  const deleteWithId = deletePersonalResource.bind(null, r.id);

  const iconBg =
    r.type === "link"
      ? "bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400"
      : r.type === "credential"
        ? "bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400"
        : "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400";

  const Icon =
    r.type === "link" ? Link2 : r.type === "credential" ? KeyRound : FileText;

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{r.title}</p>
          {r.description && (
            <p className="text-sm text-zinc-500">{r.description}</p>
          )}
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {r.url}
            </a>
          )}
          {r.username && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
              <span className="text-xs font-medium text-zinc-500 w-20 shrink-0">Username</span>
              <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{r.username}</span>
            </div>
          )}
          {r.password && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
              <span className="text-xs font-medium text-zinc-500 w-20 shrink-0">Password</span>
              <span className="font-mono text-sm tracking-widest text-zinc-500">{"•".repeat(Math.min(r.password.length, 12))}</span>
            </div>
          )}
          {r.fileUrl && (
            <a
              href={r.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 underline dark:text-zinc-300"
            >
              <FileText className="h-3.5 w-3.5" />
              Download{r.fileName ? ` (${r.fileName})` : ""}
            </a>
          )}
          {r.externalUrl && (
            <a
              href={r.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
          )}
        </div>
        <form action={deleteWithId} className="shrink-0">
          <button
            type="submit"
            title="Remove"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
