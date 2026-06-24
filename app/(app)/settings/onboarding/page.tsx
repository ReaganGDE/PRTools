import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import {
  GraduationCap,
  FileText,
  BookOpen,
  MessageCircleQuestion,
  Plus,
  Trash2,
  Check,
  ExternalLink,
  Eye,
  UserPlus,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  users,
  onboardingPaperwork,
  onboardingPaperworkTemplates,
  onboardingLearnings,
  onboardingQuestions,
} from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { ensureDefaultPaperworkTemplates } from "@/lib/onboarding-paperwork";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setUserOnboarding,
  createPaperwork,
  deletePaperwork,
  approvePaperwork,
  createLearning,
  updateLearning,
  deleteLearning,
  createTestUser,
  startImpersonation,
  createPaperworkTemplate,
  updatePaperworkTemplate,
  deletePaperworkTemplate,
  restoreDefaultPaperworkTemplates,
} from "./actions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  pending: { label: "Pending", color: "text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300" },
  submitted: { label: "Submitted", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400" },
  approved: { label: "Approved", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" },
} as const;

function StatusBadge({ status }: { status: "pending" | "submitted" | "approved" }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  );
}

const TABS = ["people", "required", "paperwork", "learnings", "questions"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  people: "People",
  required: "Required docs",
  paperwork: "Paperwork",
  learnings: "Learnings",
  questions: "Questions",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function OnboardingAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSessionWithCap("onboarding.admin");

  // Seed the standard new-hire packet the first time this workspace opens the
  // page (no-op once any templates exist).
  await ensureDefaultPaperworkTemplates(session.workspaceId);

  const params = await searchParams;
  const rawTab = (params.tab as string | undefined) ?? "people";
  const tab = (TABS as readonly string[]).includes(rawTab)
    ? (rawTab as (typeof TABS)[number])
    : "people";

  // Load all data in parallel
  const [workspaceUsers, templateList, paperworkList, learningList, questionList] =
    await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isOnboarding: users.isOnboarding,
      })
      .from(users)
      .where(eq(users.workspaceId, session.workspaceId))
      .orderBy(users.name),
    db
      .select()
      .from(onboardingPaperworkTemplates)
      .where(eq(onboardingPaperworkTemplates.workspaceId, session.workspaceId))
      .orderBy(onboardingPaperworkTemplates.sortOrder),
    db
      .select()
      .from(onboardingPaperwork)
      .where(eq(onboardingPaperwork.workspaceId, session.workspaceId))
      .orderBy(onboardingPaperwork.createdAt),
    db
      .select()
      .from(onboardingLearnings)
      .where(eq(onboardingLearnings.workspaceId, session.workspaceId))
      .orderBy(onboardingLearnings.sortOrder),
    db
      .select()
      .from(onboardingQuestions)
      .where(eq(onboardingQuestions.workspaceId, session.workspaceId))
      .orderBy(desc(onboardingQuestions.createdAt)),
  ]);

  const userById = new Map(workspaceUsers.map((u) => [u.id, u]));
  const onboardingUsers = workspaceUsers.filter((u) => u.isOnboarding);

  // For the Paperwork tab: which users to show (onboardees, or anyone who has paperwork).
  const paperworkByUser = new Map<string, typeof paperworkList>();
  for (const p of paperworkList) {
    const arr = paperworkByUser.get(p.userId) ?? [];
    arr.push(p);
    paperworkByUser.set(p.userId, arr);
  }
  const paperworkUserIds = new Set<string>([
    ...onboardingUsers.map((u) => u.id),
    ...paperworkList.map((p) => p.userId),
  ]);
  const paperworkUsers = workspaceUsers.filter((u) => paperworkUserIds.has(u.id));

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Set up new-hire paperwork, learning materials, and see their questions."
      />

      {/* Tab bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-4xl gap-0 px-8">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`?tab=${t}`}
              className={[
                "border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors",
                tab === t
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
              ].join(" ")}
            >
              {TAB_LABELS[t]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-8">
        {/* ─── People ─────────────────────────────────────────────────── */}
        {tab === "people" && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-900 dark:text-zinc-400">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <p>
                Onboarding users only see the Onboarding portal and Resources — the rest of the
                app is hidden from them.
              </p>
            </div>

            <div className="space-y-3">
              {workspaceUsers.map((u) => {
                const toggleAction = setUserOnboarding.bind(null, u.id);
                const viewAsAction = startImpersonation.bind(null, u.id);
                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {u.name ?? u.email}
                      </p>
                      <p className="truncate text-xs text-zinc-400">
                        {u.email}
                        <span className="ml-2 text-zinc-400">{u.role}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {u.isOnboarding && (
                        <form action={viewAsAction}>
                          <Button type="submit" variant="ghost" size="sm" className="gap-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30">
                            <Eye className="h-3.5 w-3.5" />
                            View as
                          </Button>
                        </form>
                      )}
                      <form action={toggleAction} className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            name="enabled"
                            defaultChecked={u.isOnboarding}
                            className="rounded accent-indigo-600"
                          />
                          Onboarding
                        </label>
                        <Button type="submit" variant="outline" size="sm">
                          Save
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create test user */}
            <form
              action={createTestUser}
              className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <UserPlus className="h-4 w-4" /> Create test user
              </div>
              <p className="mb-3 text-xs text-zinc-500">
                Creates a user account directly — no invite email needed. They won&apos;t be able to
                sign in until they use magic link or Google with this email. Use &ldquo;View
                as&rdquo; to preview their experience without them logging in.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="test-name">Name</Label>
                  <Input id="test-name" name="name" placeholder="Jane Smith" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="test-email">Email</Label>
                  <Input id="test-email" name="email" type="email" required placeholder="email@example.com" />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit">Create &amp; set to onboarding</Button>
              </div>
            </form>
          </>
        )}

        {/* ─── Required docs (templates) ──────────────────────────────── */}
        {tab === "required" && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-900 dark:text-zinc-400">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <p>
                These documents are given to <strong>every</strong> new hire automatically. When an
                onboardee opens their portal, each one appears as a paperwork item for them to
                download, complete, and upload back.
              </p>
            </div>

            <div className="space-y-4">
              {templateList.map((t) => {
                const updateAction = updatePaperworkTemplate.bind(null, t.id);
                const deleteAction = deletePaperworkTemplate.bind(null, t.id);
                const fileHref = t.templateFileUrl || t.templateUrl;
                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
                  >
                    <form action={updateAction} className="p-5">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <FileText className="h-4 w-4 text-zinc-400" />
                        <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {t.title}
                        </span>
                        {fileHref && (
                          <a
                            href={fileHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t.templateFileName ?? "View template"}
                          </a>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label htmlFor={`t-title-${t.id}`}>Title</Label>
                          <Input
                            id={`t-title-${t.id}`}
                            name="title"
                            defaultValue={t.title}
                            required
                          />
                        </div>
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label htmlFor={`t-desc-${t.id}`}>Description</Label>
                          <Input
                            id={`t-desc-${t.id}`}
                            name="description"
                            defaultValue={t.description ?? ""}
                            placeholder="Optional instructions"
                          />
                        </div>
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label htmlFor={`t-url-${t.id}`}>Template link (optional)</Label>
                          <Input
                            id={`t-url-${t.id}`}
                            name="templateUrl"
                            type="url"
                            defaultValue={t.templateUrl ?? ""}
                            placeholder="https://"
                          />
                          {t.templateFileUrl && (
                            <p className="text-xs text-zinc-400">
                              A bundled file template is attached ({t.templateFileName}). A link here
                              is shown in addition.
                            </p>
                          )}
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`t-sort-${t.id}`}>Sort order</Label>
                          <Input
                            id={`t-sort-${t.id}`}
                            name="sortOrder"
                            type="number"
                            defaultValue={t.sortOrder}
                          />
                        </div>
                        <div className="flex items-start gap-2 sm:col-span-2">
                          <input
                            type="checkbox"
                            id={`t-day1-${t.id}`}
                            name="allowBringOnDay1"
                            defaultChecked={t.allowBringOnDay1}
                            className="mt-0.5 rounded accent-indigo-600"
                          />
                          <div>
                            <label htmlFor={`t-day1-${t.id}`} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              Allow &ldquo;bring on day one&rdquo;
                            </label>
                            <p className="text-xs text-zinc-400">
                              Shows a checkbox in the portal letting the employee indicate they&apos;ll bring the completed form physically. Only enable for forms that legally require in-person handling (I-9).
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
                        <Button
                          type="submit"
                          formAction={deleteAction}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Remove
                        </Button>
                        <Button type="submit" variant="outline" size="sm">
                          Save changes
                        </Button>
                      </div>
                    </form>
                  </div>
                );
              })}
            </div>

            {/* Add custom required doc */}
            <form
              action={createPaperworkTemplate}
              className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Plus className="h-4 w-4" /> Add a required document
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-t-title">Title</Label>
                  <Input id="new-t-title" name="title" required placeholder="e.g. NDA" />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-t-desc">Description</Label>
                  <Input id="new-t-desc" name="description" placeholder="Optional instructions" />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-t-url">Template link (optional)</Label>
                  <Input id="new-t-url" name="templateUrl" type="url" placeholder="https://" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-t-sort">Sort order</Label>
                  <Input id="new-t-sort" name="sortOrder" type="number" defaultValue={templateList.length} />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit">Add document</Button>
              </div>
            </form>

            <form action={restoreDefaultPaperworkTemplates}>
              <Button type="submit" variant="ghost" size="sm" className="text-zinc-500">
                Restore standard new-hire packet
              </Button>
            </form>
          </>
        )}

        {/* ─── Paperwork ──────────────────────────────────────────────── */}
        {tab === "paperwork" && (
          <>
            {paperworkUsers.length === 0 ? (
              <p className="rounded-xl border border-zinc-200/80 bg-white p-5 text-sm text-zinc-500 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
                No onboardees yet — mark someone as an onboarding user on the People tab first.
              </p>
            ) : (
              <div className="space-y-6">
                {paperworkUsers.map((u) => {
                  const items = paperworkByUser.get(u.id) ?? [];
                  return (
                    <div key={u.id} className="space-y-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        <FileText className="h-4 w-4 text-zinc-400" />
                        {u.name ?? u.email}
                      </h3>
                      {items.length === 0 ? (
                        <p className="text-xs text-zinc-400">No paperwork items yet.</p>
                      ) : (
                        items.map((p) => {
                          const approveAction = approvePaperwork.bind(null, p.id);
                          const deleteAction = deletePaperwork.bind(null, p.id);
                          return (
                            <div
                              key={p.id}
                              className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
                            >
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <StatusBadge status={p.status} />
                                {p.bringsOnDay1 && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                                    Bringing on day one
                                  </span>
                                )}
                                <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                  {p.title}
                                </span>
                              </div>
                              {p.description && (
                                <p className="mb-3 text-sm text-zinc-500">{p.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-4 text-sm">
                                {p.templateUrl && (
                                  <a
                                    href={p.templateUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Template
                                  </a>
                                )}
                                {p.templateFileUrl && (
                                  <a
                                    href={p.templateFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    {p.templateFileName ?? "Template file"}
                                  </a>
                                )}
                                {p.submittedFileUrl ? (
                                  <a
                                    href={p.submittedFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    {p.submittedFileName ?? "Submitted file"}
                                  </a>
                                ) : (
                                  p.status !== "pending" && (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                      <FileText className="h-3.5 w-3.5" />
                                      {p.submittedFileName ?? "Saved to SharePoint"}
                                    </span>
                                  )
                                )}
                              </div>
                              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
                                <form action={deleteAction}>
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                  >
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                    Delete
                                  </Button>
                                </form>
                                {p.status === "submitted" && (
                                  <form action={approveAction}>
                                    <Button type="submit" variant="outline" size="sm">
                                      <Check className="mr-1.5 h-3.5 w-3.5" />
                                      Approve
                                    </Button>
                                  </form>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add paperwork item */}
            {onboardingUsers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700">
                Mark someone as an onboarding user on the People tab first.
              </p>
            ) : (
              <form
                action={createPaperwork}
                className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700"
              >
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <Plus className="h-4 w-4" /> Add paperwork item
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-pw-user">Onboardee</Label>
                    <select
                      id="new-pw-user"
                      name="userId"
                      required
                      className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {onboardingUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name ?? u.email}
                          {u.name ? ` (${u.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-pw-title">Title</Label>
                    <Input id="new-pw-title" name="title" required placeholder="e.g. W-4 form" />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="new-pw-desc">Description</Label>
                    <Input
                      id="new-pw-desc"
                      name="description"
                      placeholder="Optional instructions"
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="new-pw-template">Template URL</Label>
                    <Input
                      id="new-pw-template"
                      name="templateUrl"
                      type="url"
                      placeholder="https://"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button type="submit">Add paperwork</Button>
                </div>
              </form>
            )}
          </>
        )}

        {/* ─── Learnings ──────────────────────────────────────────────── */}
        {tab === "learnings" && (
          <>
            <p className="text-sm text-zinc-500">
              Learning materials are workspace-wide — every onboardee sees all of them.
            </p>

            <div className="space-y-4">
              {learningList.map((l) => {
                const updateAction = updateLearning.bind(null, l.id);
                const deleteAction = deleteLearning.bind(null, l.id);
                return (
                  <div
                    key={l.id}
                    className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
                  >
                    <form action={updateAction} className="p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-zinc-400" />
                        <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {l.title}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label htmlFor={`l-title-${l.id}`}>Title</Label>
                          <Input
                            id={`l-title-${l.id}`}
                            name="title"
                            defaultValue={l.title}
                            required
                          />
                        </div>
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label htmlFor={`l-desc-${l.id}`}>Description</Label>
                          <Input
                            id={`l-desc-${l.id}`}
                            name="description"
                            defaultValue={l.description ?? ""}
                            placeholder="Optional description"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`l-type-${l.id}`}>Type</Label>
                          <select
                            id={`l-type-${l.id}`}
                            name="type"
                            defaultValue={l.type}
                            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <option value="link">Link</option>
                            <option value="text">Text</option>
                          </select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`l-sort-${l.id}`}>Sort order</Label>
                          <Input
                            id={`l-sort-${l.id}`}
                            name="sortOrder"
                            type="number"
                            defaultValue={l.sortOrder}
                          />
                        </div>
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label htmlFor={`l-url-${l.id}`}>URL</Label>
                          <Input
                            id={`l-url-${l.id}`}
                            name="url"
                            type="url"
                            defaultValue={l.url ?? ""}
                            placeholder="https://"
                          />
                        </div>
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label htmlFor={`l-body-${l.id}`}>Body</Label>
                          <textarea
                            id={`l-body-${l.id}`}
                            name="body"
                            defaultValue={l.body ?? ""}
                            rows={4}
                            placeholder="Inline text content (for text type)"
                            className="flex w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-all duration-150 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
                        <Button
                          type="submit"
                          formAction={deleteAction}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                        <Button type="submit" variant="outline" size="sm">
                          Save changes
                        </Button>
                      </div>
                    </form>
                  </div>
                );
              })}
            </div>

            {/* Create learning form */}
            <form
              action={createLearning}
              className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Plus className="h-4 w-4" /> Add a learning
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-l-title">Title</Label>
                  <Input id="new-l-title" name="title" required placeholder="Learning title" />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-l-desc">Description</Label>
                  <Input id="new-l-desc" name="description" placeholder="Optional description" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-l-type">Type</Label>
                  <select
                    id="new-l-type"
                    name="type"
                    defaultValue="link"
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="link">Link</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-l-sort">Sort order</Label>
                  <Input id="new-l-sort" name="sortOrder" type="number" defaultValue={0} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-l-url">URL</Label>
                  <Input id="new-l-url" name="url" type="url" placeholder="https://" />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-l-body">Body</Label>
                  <textarea
                    id="new-l-body"
                    name="body"
                    rows={4}
                    placeholder="Inline text content (for text type)"
                    className="flex w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-all duration-150 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit">Add learning</Button>
              </div>
            </form>
          </>
        )}

        {/* ─── Questions ──────────────────────────────────────────────── */}
        {tab === "questions" && (
          <>
            {questionList.length === 0 ? (
              <p className="rounded-xl border border-zinc-200/80 bg-white p-5 text-sm text-zinc-500 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
                No questions yet.
              </p>
            ) : (
              <div className="space-y-4">
                {questionList.map((q) => {
                  const asker = userById.get(q.userId);
                  return (
                    <div
                      key={q.id}
                      className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <MessageCircleQuestion className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {asker?.name ?? asker?.email ?? "Unknown user"}
                        </span>
                        {asker?.name && (
                          <span className="text-xs text-zinc-400">{asker.email}</span>
                        )}
                        {q.emailedAt && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            Emailed
                          </span>
                        )}
                        <span className="ml-auto text-xs text-zinc-400">
                          {q.createdAt.toLocaleDateString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                        {q.question}
                      </p>
                      {q.pageContext && (
                        <p className="mt-2 text-xs text-zinc-400">Asked from: {q.pageContext}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
