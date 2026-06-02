import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc, notInArray } from "drizzle-orm";
import { ChevronLeft, Users } from "lucide-react";
import { db } from "@/lib/db";
import { contactLists, contactListMembers, contacts } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ListMembersTable } from "./members-table";
import { renameList, deleteList } from "../../actions";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [list] = await db
    .select()
    .from(contactLists)
    .where(
      and(
        eq(contactLists.id, id),
        eq(contactLists.workspaceId, session.workspaceId),
      ),
    );
  if (!list) notFound();

  const members = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      type: contacts.type,
      email: contacts.email,
      outlet: contacts.outlet,
      followerCount: contacts.followerCount,
      addedAt: contactListMembers.addedAt,
    })
    .from(contactListMembers)
    .innerJoin(contacts, eq(contactListMembers.contactId, contacts.id))
    .where(eq(contactListMembers.listId, id))
    .orderBy(desc(contactListMembers.addedAt));

  const memberIds = members.map((m) => m.id);
  // Up to 200 contacts not yet in this list, sorted by name — for the
  // "Add contacts" picker on this page.
  const candidates =
    memberIds.length > 0
      ? await db
          .select({
            id: contacts.id,
            name: contacts.name,
            type: contacts.type,
            email: contacts.email,
            outlet: contacts.outlet,
          })
          .from(contacts)
          .where(
            and(
              eq(contacts.workspaceId, session.workspaceId),
              notInArray(contacts.id, memberIds),
            ),
          )
          .orderBy(contacts.name)
          .limit(500)
      : await db
          .select({
            id: contacts.id,
            name: contacts.name,
            type: contacts.type,
            email: contacts.email,
            outlet: contacts.outlet,
          })
          .from(contacts)
          .where(eq(contacts.workspaceId, session.workspaceId))
          .orderBy(contacts.name)
          .limit(500);

  async function handleRename(fd: FormData) {
    "use server";
    await renameList(
      id,
      String(fd.get("name") ?? ""),
      String(fd.get("description") ?? ""),
    );
  }

  async function handleDelete() {
    "use server";
    const { redirect } = await import("next/navigation");
    await deleteList(id);
    redirect("/contacts/lists");
  }

  return (
    <>
      <PageHeader
        title={list.name}
        description={list.description ?? `${members.length} contacts`}
        actions={
          <form action={handleDelete}>
            <Button type="submit" variant="ghost" className="text-red-600 hover:text-red-700">
              Delete list
            </Button>
          </form>
        }
      />
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <div>
          <Link
            href="/contacts/lists"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" /> All lists
          </Link>
        </div>

        {/* Edit list metadata */}
        <form
          action={handleRename}
          className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <div className="grid gap-1.5">
              <label htmlFor="name" className="text-xs font-medium text-zinc-500">
                Name
              </label>
              <input
                id="name"
                name="name"
                defaultValue={list.name}
                required
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="description"
                className="text-xs font-medium text-zinc-500"
              >
                Description
              </label>
              <input
                id="description"
                name="description"
                defaultValue={list.description ?? ""}
                placeholder="What's this list for?"
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" className="self-end">
              Save
            </Button>
          </div>
        </form>

        {/* Members + add picker */}
        <ListMembersTable
          listId={id}
          listName={list.name}
          members={members}
          candidates={candidates}
        />

        {members.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">No contacts in this list yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Use the picker above to add contacts, or go to{" "}
              <Link href="/contacts" className="text-red-600 hover:underline dark:text-red-400">
                Contacts
              </Link>{" "}
              and bulk-select.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
