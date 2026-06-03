import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { can, type Role } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FollowUpDaysForm } from "./follow-up-days-form";
function isSet(name: string) {
  const v = process.env[name];
  return !!(v && v.length > 0);
}

export default async function SettingsPage() {
  const session = await auth();
  const wsId = session!.user.workspaceId!;
  const role = session!.user.role as Role | undefined;
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
  const members = await db
    .select({ email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.workspaceId, wsId));

  const integrations: { name: string; ok: boolean; phase: string }[] = [
    { name: "Resend (email)", ok: isSet("RESEND_API_KEY"), phase: "Phase 1" },
    { name: "Anthropic (sentiment scoring)", ok: isSet("ANTHROPIC_API_KEY"), phase: "Phase 5" },
    { name: "NewsAPI", ok: isSet("NEWS_API_KEY"), phase: "Phase 5" },
    { name: "Reddit OAuth", ok: isSet("REDDIT_CLIENT_ID"), phase: "Phase 4b" },
    { name: "YouTube Data API", ok: isSet("YOUTUBE_API_KEY"), phase: "Phase 5/6" },
    { name: "Instagram Graph API", ok: isSet("META_APP_ID"), phase: "Phase 4b+ (optional)" },
    { name: "Inngest (background jobs)", ok: isSet("INNGEST_EVENT_KEY"), phase: "Phase 5" },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Workspace, team, and integrations." />
      <div className="grid gap-6 p-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>{ws?.name}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-zinc-500">
            Created {ws?.createdAt.toLocaleDateString()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>
              <Link href="/settings/team" className="hover:underline">
                Manage invites →
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {members.map((m) => (
                <li key={m.email} className="flex justify-between">
                  <span>{m.name ?? m.email}</span>
                  <span className="text-xs text-zinc-500">{m.role}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {can(role, "audit.view") ? (
          <Card>
            <CardHeader>
              <CardTitle>Audit log</CardTitle>
              <CardDescription>
                <Link href="/settings/audit" className="hover:underline">
                  View workspace activity →
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-zinc-500">
              Track who changed what, sends, role changes, and more.
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>PR Settings</CardTitle>
            <CardDescription>Configure follow-up reminders and other PR defaults.</CardDescription>
          </CardHeader>
          <CardContent>
            <FollowUpDaysForm defaultValue={ws?.followUpDays ?? 4} />
            <p className="mt-2 text-xs text-zinc-400">
              Contacts who received a screener this many days ago without a reply will appear in the dashboard follow-ups section.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              <Link href="/settings/integrations" className="hover:underline">
                Configure Airtable and other workspace integrations →
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Environment status
            </p>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {integrations.map((i) => (
                <li key={i.name} className="flex items-center justify-between py-2 text-sm">
                  <span>{i.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">{i.phase}</span>
                    <span
                      className={
                        i.ok
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
                          : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }
                    >
                      {i.ok ? "Connected" : "Not set"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
