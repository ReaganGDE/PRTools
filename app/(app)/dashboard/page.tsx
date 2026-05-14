import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, sends, mentions, campaigns } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  const wsId = session!.user.workspaceId!;

  const [
    [{ value: contactCount }],
    [{ value: campaignCount }],
    [{ value: sendCount }],
    [{ value: mentionCount }],
  ] = await Promise.all([
    db.select({ value: count() }).from(contacts).where(eq(contacts.workspaceId, wsId)),
    db.select({ value: count() }).from(campaigns).where(eq(campaigns.workspaceId, wsId)),
    db.select({ value: count() }).from(sends).where(eq(sends.workspaceId, wsId)),
    db.select({ value: count() }).from(mentions).where(eq(mentions.workspaceId, wsId)),
  ]);

  const stats = [
    { label: "Contacts", value: contactCount },
    { label: "Campaigns", value: campaignCount },
    { label: "Messages sent", value: sendCount },
    { label: "Mentions tracked", value: mentionCount },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${session!.user.name ?? session!.user.email}`}
        description="Quick overview of your workspace."
      />
      <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
