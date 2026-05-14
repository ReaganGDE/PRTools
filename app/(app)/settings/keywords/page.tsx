import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { keywords } from "@/lib/db/schema";
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
import {
  addKeyword,
  toggleKeyword,
  deleteKeyword,
  triggerPoll,
} from "@/app/(app)/sentiment/actions";

export default async function KeywordsPage() {
  const session = await requireSession();
  const editable = can(session.role, "sentiment.keywords.edit");

  const rows = await db
    .select()
    .from(keywords)
    .where(eq(keywords.workspaceId, session.workspaceId))
    .orderBy(desc(keywords.createdAt));

  return (
    <>
      <PageHeader
        title="Keywords"
        description="Terms to monitor across news, Reddit, and YouTube."
        actions={
          editable ? (
            <form
              action={async () => {
                "use server";
                await triggerPoll();
              }}
            >
              <Button type="submit" variant="outline">
                Poll now
              </Button>
            </form>
          ) : null
        }
      />
      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Add keyword</CardTitle>
            <CardDescription>
              e.g. your company name, film title, key product name.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {editable ? (
              <form action={addKeyword} className="flex flex-col gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="term">Term</Label>
                  <Input id="term" name="term" required placeholder="Film X" />
                </div>
                <Button type="submit">Add</Button>
              </form>
            ) : (
              <p className="text-sm text-zinc-500">
                Only owner/admin can edit keywords.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tracking ({rows.length})</CardTitle>
            <CardDescription>
              Polling runs hourly via Vercel Cron. Click &quot;Poll now&quot; to refresh
              immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-zinc-500">No keywords yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{k.term}</span>
                      {!k.active ? (
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          paused
                        </span>
                      ) : null}
                    </div>
                    {editable ? (
                      <div className="flex items-center gap-1">
                        <form action={toggleKeyword.bind(null, k.id, !k.active)}>
                          <Button type="submit" size="sm" variant="ghost">
                            {k.active ? "Pause" : "Resume"}
                          </Button>
                        </form>
                        <form action={deleteKeyword.bind(null, k.id)}>
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
