import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contacts,
  sends,
  dmThreads,
  dmMessages,
  contactLists,
  contactListMembers,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contact-form";
import { updateContact, deleteContact } from "../actions";
import { ListMembership } from "./list-membership";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.id, id), eq(contacts.workspaceId, session.workspaceId)),
    );

  if (!contact) notFound();

  const sendRows = await db
    .select()
    .from(sends)
    .where(eq(sends.contactId, id))
    .orderBy(desc(sends.createdAt))
    .limit(50);

  const threads = await db
    .select()
    .from(dmThreads)
    .where(eq(dmThreads.contactId, id));

  let messageRows: { id: string; direction: string; body: string; sentAt: Date }[] =
    [];
  if (threads.length > 0) {
    messageRows = await db
      .select({
        id: dmMessages.id,
        direction: dmMessages.direction,
        body: dmMessages.body,
        sentAt: dmMessages.sentAt,
      })
      .from(dmMessages)
      .where(
        eq(
          dmMessages.threadId,
          threads[0].id, // simplification: show messages from first thread
        ),
      )
      .orderBy(desc(dmMessages.sentAt))
      .limit(50);
  }

  // Lists this contact belongs to
  const lists = await db
    .select({ id: contactLists.id, name: contactLists.name })
    .from(contactListMembers)
    .innerJoin(contactLists, eq(contactListMembers.listId, contactLists.id))
    .where(eq(contactListMembers.contactId, id));

  // All lists in the workspace (for the picker)
  const allLists = await db
    .select({ id: contactLists.id, name: contactLists.name })
    .from(contactLists)
    .where(eq(contactLists.workspaceId, session.workspaceId))
    .orderBy(contactLists.name);

  const boundUpdate = updateContact.bind(null, contact.id);
  const boundDelete = deleteContact.bind(null, contact.id);

  return (
    <>
      <PageHeader
        title={contact.name}
        description={[contact.outlet, contact.beat].filter(Boolean).join(" · ") || undefined}
        actions={
          <form action={boundDelete}>
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </form>
        }
      />

      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Details
          </h2>
          <ContactForm
            action={boundUpdate}
            initial={contact}
            submitLabel="Save changes"
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lists</CardTitle>
              <CardDescription>Segments this contact is in.</CardDescription>
            </CardHeader>
            <CardContent>
              <ListMembership
                contactId={contact.id}
                contactLists={lists}
                allLists={allLists}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent sends</CardTitle>
            </CardHeader>
            <CardContent>
              {sendRows.length === 0 ? (
                <p className="text-sm text-zinc-500">No outreach yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {sendRows.slice(0, 10).map((s) => (
                    <li key={s.id} className="flex justify-between">
                      <span className="capitalize">
                        {s.channel} · {s.platform ?? "—"}
                      </span>
                      <span className="text-xs text-zinc-500">{s.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {messageRows.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">DM thread</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {messageRows.slice(0, 10).map((m) => (
                    <li
                      key={m.id}
                      className={
                        m.direction === "inbound"
                          ? "rounded bg-zinc-100 p-2 dark:bg-zinc-900"
                          : "rounded bg-blue-50 p-2 dark:bg-blue-950"
                      }
                    >
                      <div className="text-xs text-zinc-500">
                        {m.direction}
                      </div>
                      {m.body}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {contact.notes ? (
        <div className="p-8 pt-0">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Notes
          </h2>
          <div className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            {contact.notes}
          </div>
        </div>
      ) : null}
    </>
  );
}
