import Link from "next/link";
import { and, desc, eq, ilike, or, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contacts,
  contactLists,
  contactListMembers,
  movies,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactsTable } from "./contacts-table";

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

  const [lists, movieOptions] = await Promise.all([
    db
      .select({
        id: contactLists.id,
        name: contactLists.name,
        memberCount: sql<number>`count(${contactListMembers.contactId})::int`,
      })
      .from(contactLists)
      .leftJoin(contactListMembers, eq(contactListMembers.listId, contactLists.id))
      .where(eq(contactLists.workspaceId, session.workspaceId))
      .groupBy(contactLists.id),
    db
      .select({ id: movies.id, title: movies.title })
      .from(movies)
      .where(eq(movies.workspaceId, session.workspaceId))
      .orderBy(movies.title),
  ]);

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
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              {q || type || tag || listId
                ? "No contacts match those filters."
                : "No contacts yet. Import a CSV or add your first one."}
            </p>
          </div>
        ) : (
          <ContactsTable
            rows={rows.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              email: c.email,
              outlet: c.outlet,
              handleInstagram: c.handleInstagram,
              handleTiktok: c.handleTiktok,
              handleReddit: c.handleReddit,
              handleYoutube: c.handleYoutube,
              followerCount: c.followerCount,
              tags: c.tags,
            }))}
            lists={lists}
            movies={movieOptions}
            totalShown={rows.length}
            pageSize={PAGE_SIZE}
          />
        )}
      </div>
    </>
  );
}
