import Link from "next/link";
import { and, desc, eq, ilike, or, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contacts,
  contactLists,
  contactListMembers,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 100;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    tag?: string;
    list?: string;
  }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const type = sp.type;
  const tag = sp.tag?.trim();
  const listId = sp.list;

  const wsCond = eq(contacts.workspaceId, session.workspaceId);
  const conds = [wsCond];
  if (q) {
    conds.push(
      or(
        ilike(contacts.name, `%${q}%`),
        ilike(contacts.email, `%${q}%`),
        ilike(contacts.outlet, `%${q}%`),
        ilike(contacts.handleInstagram, `%${q}%`),
        ilike(contacts.handleTiktok, `%${q}%`),
        ilike(contacts.handleReddit, `%${q}%`),
        ilike(contacts.handleYoutube, `%${q}%`),
      )!,
    );
  }
  if (type && ["influencer", "outlet", "journalist"].includes(type)) {
    conds.push(eq(contacts.type, type as "influencer" | "outlet" | "journalist"));
  }
  if (tag) {
    conds.push(sql`${tag} = ANY(${contacts.tags})`);
  }
  let idsInList: string[] | null = null;
  if (listId) {
    const members = await db
      .select({ id: contactListMembers.contactId })
      .from(contactListMembers)
      .where(eq(contactListMembers.listId, listId));
    idsInList = members.map((m) => m.id);
    if (idsInList.length === 0) idsInList = ["__never__"];
    conds.push(inArray(contacts.id, idsInList));
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conds))
    .orderBy(desc(contacts.createdAt))
    .limit(PAGE_SIZE);

  const lists = await db
    .select({
      id: contactLists.id,
      name: contactLists.name,
      memberCount: sql<number>`count(${contactListMembers.contactId})::int`,
    })
    .from(contactLists)
    .leftJoin(
      contactListMembers,
      eq(contactListMembers.listId, contactLists.id),
    )
    .where(eq(contactLists.workspaceId, session.workspaceId))
    .groupBy(contactLists.id);

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Influencers, journalists, and outlets."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/contacts/lists">Lists</Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                href={`/api/export/contacts${
                  q || type || tag || listId
                    ? `?${new URLSearchParams(
                        Object.entries({ q, type, tag, list: listId }).filter(
                          ([, v]) => !!v,
                        ) as [string, string][],
                      ).toString()}`
                    : ""
                }`}
              >
                Export CSV
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contacts/import">Import CSV</Link>
            </Button>
            <Button asChild>
              <Link href="/contacts/new">Add contact</Link>
            </Button>
          </>
        }
      />
      <div className="space-y-4 p-8">
        <form className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-500">Search</label>
            <Input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Name, email, outlet, handle…"
              className="w-64"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-500">Type</label>
            <select
              name="type"
              defaultValue={type ?? ""}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All</option>
              <option value="influencer">Influencer</option>
              <option value="outlet">Outlet</option>
              <option value="journalist">Journalist</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-500">Tag</label>
            <Input
              type="search"
              name="tag"
              defaultValue={tag ?? ""}
              placeholder="e.g. tier-1"
              className="w-40"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-500">List</label>
            <select
              name="list"
              defaultValue={listId ?? ""}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.memberCount})
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {(q || type || tag || listId) ? (
            <Button asChild variant="ghost">
              <Link href="/contacts">Reset</Link>
            </Button>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              {q || type || tag || listId
                ? "No contacts match those filters."
                : "No contacts yet. Import a CSV or add your first one."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Outlet</th>
                  <th className="px-4 py-2 font-medium">Handles</th>
                  <th className="px-4 py-2 font-medium">Followers</th>
                  <th className="px-4 py-2 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="px-4 py-2">
                      <Link
                        href={`/contacts/${c.id}`}
                        className="hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{c.type}</td>
                    <td className="px-4 py-2 text-zinc-500">{c.email ?? "—"}</td>
                    <td className="px-4 py-2 text-zinc-500">{c.outlet ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-zinc-500">
                      {[
                        c.handleInstagram && `IG:${c.handleInstagram}`,
                        c.handleTiktok && `TT:${c.handleTiktok}`,
                        c.handleReddit && `R:${c.handleReddit}`,
                        c.handleYoutube && `YT:${c.handleYoutube}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {c.followerCount?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {c.tags.length === 0 ? (
                        "—"
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              {t}
                            </span>
                          ))}
                          {c.tags.length > 3 ? (
                            <span className="text-zinc-400">
                              +{c.tags.length - 3}
                            </span>
                          ) : null}
                        </div>
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
