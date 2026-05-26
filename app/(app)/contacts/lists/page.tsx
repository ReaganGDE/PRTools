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
            <ul className="space-y-2">
              {lists.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/contacts/lists/${l.id}`}
                    className="group flex items-center justify-between rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900"
                  >
                    <div>
                      <div className="font-medium tracking-tight">{l.name}</div>
                      {l.description ? (
                        <p className="text-xs text-zinc-500">{l.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium tabular-nums dark:bg-zinc-800">
                        {l.memberCount}
                      </span>
                      <span className="text-xs text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100">
                        Manage →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
