import Link from "next/link";
import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  messageTemplates,
  contactLists,
  contactListMembers,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCampaign } from "../../actions";

export default async function NewCampaignPage() {
  const session = await requireSession();

  const templates = await db
    .select({ id: messageTemplates.id, name: messageTemplates.name })
    .from(messageTemplates)
    .where(
      and(
        eq(messageTemplates.workspaceId, session.workspaceId),
        eq(messageTemplates.channel, "email"),
      ),
    )
    .orderBy(desc(messageTemplates.updatedAt));

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

  if (templates.length === 0 || lists.length === 0) {
    return (
      <>
        <PageHeader title="New email campaign" />
        <div className="p-8">
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              You need at least one template and one contact list to create a
              campaign.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link href="/email/templates/new">Create template</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contacts/lists">Create list</Link>
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="New email campaign" />
      <div className="p-8">
        <form action={createCampaign} className="grid max-w-xl gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Campaign name</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g. Film X press release blast"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="templateId">Template</Label>
            <select
              id="templateId"
              name="templateId"
              required
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="listId">Contact list</Label>
            <select
              id="listId"
              name="listId"
              required
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.memberCount} contacts)
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Create draft</Button>
          </div>
        </form>
      </div>
    </>
  );
}
