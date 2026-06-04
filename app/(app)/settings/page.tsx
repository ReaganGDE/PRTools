import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { can, type Role, ROLE_RANK } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FollowUpDaysForm } from "./follow-up-days-form";
import { ThemePicker } from "./theme-picker";
import { RolePreviewPicker } from "./role-preview-picker";

function isSet(name: string) {
  const v = process.env[name];
  return !!(v && v.length > 0);
}

export default async function SettingsPage() {
  const session = await auth();
  const wsId = session!.user.workspaceId!;

  const jar = await cookies();
  const theme = jar.get("user-theme")?.value ?? "system";
  const previewRoleCookie = jar.get("preview_role")?.value as Role | undefined;

  const [ws, members, userRow] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, wsId)).then((r) => r[0]),
    db.select({ email: users.email, name: users.name, role: users.role }).from(users).where(eq(users.workspaceId, wsId)),
    session!.user.id
      ? db.select({ role: users.role }).from(users).where(eq(users.id, session!.user.id!)).then((r) => r[0])
      : Promise.resolve(undefined),
  ]);

  const actualRole = (userRow?.role ?? "member") as Role;
  // Use effective role for capability checks (honour any active preview).
  const validRoles: Role[] = ["owner", "admin", "member", "viewer"];
  const isValidPreview =
    !!previewRoleCookie &&
    validRoles.includes(previewRoleCookie) &&
    (ROLE_RANK[actualRole] ?? 0) > (ROLE_RANK[previewRoleCookie] ?? 0);
  const role = isValidPreview ? previewRoleCookie! : actualRole;

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

        {/* Appearance — per-user theme preference */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose your preferred color scheme. Applies only to your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemePicker initialTheme={theme} />
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

        {/* View as role — admins+ can preview the app as a lower-tier user */}
        {can(actualRole, "team.invite") && (
          <Card>
            <CardHeader>
              <CardTitle>View as role</CardTitle>
              <CardDescription>
                Preview the app exactly as a lower-tier user would see it. A banner will remind you that preview mode is active.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RolePreviewPicker actualRole={actualRole} />
            </CardContent>
          </Card>
        )}

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
