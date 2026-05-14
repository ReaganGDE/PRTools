import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createInvite, listInvites } from "@/lib/invites";
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

export default async function TeamPage() {
  const session = await auth();
  const wsId = session!.user.workspaceId!;

  const members = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.workspaceId, wsId));

  const invites = await listInvites(wsId);

  async function sendInvite(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.workspaceId) return;
    if (session.user.role !== "owner" && session.user.role !== "admin") return;
    const email = (formData.get("email") as string | null)?.trim();
    if (!email) return;
    await createInvite({
      workspaceId: session.user.workspaceId,
      email,
      invitedBy: session.user.id,
    });
    revalidatePath("/settings/team");
  }

  const canInvite =
    session!.user.role === "owner" || session!.user.role === "admin";

  return (
    <>
      <PageHeader title="Team" description="Invite teammates to this workspace." />
      <div className="grid gap-6 p-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>{m.name ?? m.email}</span>
                  <span className="text-xs text-zinc-500">{m.role}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
            <CardDescription>
              They&apos;ll get an email with a magic link to join.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canInvite ? (
              <form action={sendInvite} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="teammate@company.com"
                    required
                  />
                </div>
                <Button type="submit">Send invite</Button>
              </form>
            ) : (
              <p className="text-sm text-zinc-500">
                Only owners and admins can invite.
              </p>
            )}
            {invites.length > 0 ? (
              <div className="mt-6">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Pending invites
                </div>
                <ul className="space-y-1 text-sm">
                  {invites
                    .filter((i) => !i.acceptedAt)
                    .map((i) => (
                      <li
                        key={i.id}
                        className="flex justify-between text-zinc-600"
                      >
                        <span>{i.email}</span>
                        <span className="text-xs">
                          expires {i.expiresAt.toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
