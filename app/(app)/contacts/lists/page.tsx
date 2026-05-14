import Link from "next/link";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactLists, contactListMembers } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
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
import { createList } from "../actions";
import { revalidatePath } from "next/cache";

export default async function ListsPage() {
  const session = await requireSession();

  const lists = await db
    .select({
      id: contactLists.id,
      name: contactLists.name,
      description: contactLists.description,
      createdAt: contactLists.createdAt,
      memberCount: sql<number>`count(${contactListMembers.contactId})::int`,
    })
    .from(contactLists)
    .leftJoin(
      contactListMembers,
      eq(contactListMembers.listId, contactLists.id),
    )
    .where(eq(contactLists.workspaceId, session.workspaceId))
    .groupBy(contactLists.id)
    .orderBy(desc(contactLists.createdAt));

  async function onCreate(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    await createList(name);
    revalidatePath("/contacts/lists");
  }

  return (
    <>
      <PageHeader
        title="Contact lists"
        description="Segment contacts into reusable lists for campaigns."
      />
      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>New list</CardTitle>
            <CardDescription>e.g. &quot;Tier-1 film critics&quot;</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={onCreate} className="flex flex-col gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <Button type="submit">Create</Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {lists.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500">No lists yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {lists.map((l) => (
                <li key={l.id} className="flex items-center justify-between p-4">
                  <div>
                    <Link
                      href={`/contacts?list=${l.id}`}
                      className="font-medium hover:underline"
                    >
                      {l.name}
                    </Link>
                    {l.description ? (
                      <p className="text-xs text-zinc-500">{l.description}</p>
                    ) : null}
                  </div>
                  <span className="text-sm text-zinc-500">
                    {l.memberCount} contacts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
