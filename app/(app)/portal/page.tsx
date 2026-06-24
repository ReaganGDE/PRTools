import type { ReactNode } from "react";
import { eq, and, asc } from "drizzle-orm";
import {
  FileText,
  GraduationCap,
  BookOpen,
  ExternalLink,
  Download,
  CheckCircle2,
  Link2,
  KeyRound,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  onboardingPaperwork,
  onboardingPaperworkTemplates,
  onboardingLearnings,
  resources,
  resourceGroupMembers,
  resourceGroupAssignments,
  resourceUserAssignments,
} from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { ensurePaperworkForUser } from "@/lib/onboarding-paperwork";
import { PageHeader } from "@/components/page-header";
import { submitPaperwork, setBringsOnDay1 } from "./actions";
import { QuestionBox } from "./question-box";

type PaperworkRow = typeof onboardingPaperwork.$inferSelect & {
  allowBringOnDay1: boolean | null;
};
type Learning = typeof onboardingLearnings.$inferSelect;
type Resource = typeof resources.$inferSelect;

export default async function PortalPage() {
  const session = await requireSessionWithCap("onboarding.view");

  // Make sure this onboardee has a paperwork row for every standard template
  // before we read their list (instantiates the new-hire packet on first view).
  await ensurePaperworkForUser(session.userId, session.workspaceId);

  const [
    paperwork,
    learnings,
    myGroupMemberships,
    userAssignments,
    allResources,
  ] = await Promise.all([
    db
      .select({
        id: onboardingPaperwork.id,
        workspaceId: onboardingPaperwork.workspaceId,
        userId: onboardingPaperwork.userId,
        templateId: onboardingPaperwork.templateId,
        title: onboardingPaperwork.title,
        description: onboardingPaperwork.description,
        templateUrl: onboardingPaperwork.templateUrl,
        templateFileUrl: onboardingPaperwork.templateFileUrl,
        templateFileName: onboardingPaperwork.templateFileName,
        submittedFileUrl: onboardingPaperwork.submittedFileUrl,
        submittedFileName: onboardingPaperwork.submittedFileName,
        bringsOnDay1: onboardingPaperwork.bringsOnDay1,
        status: onboardingPaperwork.status,
        submittedAt: onboardingPaperwork.submittedAt,
        createdBy: onboardingPaperwork.createdBy,
        createdAt: onboardingPaperwork.createdAt,
        updatedAt: onboardingPaperwork.updatedAt,
        allowBringOnDay1: onboardingPaperworkTemplates.allowBringOnDay1,
      })
      .from(onboardingPaperwork)
      .leftJoin(
        onboardingPaperworkTemplates,
        eq(onboardingPaperwork.templateId, onboardingPaperworkTemplates.id),
      )
      .where(
        and(
          eq(onboardingPaperwork.userId, session.userId),
          eq(onboardingPaperwork.workspaceId, session.workspaceId),
        ),
      )
      .orderBy(asc(onboardingPaperwork.createdAt)),
    db
      .select()
      .from(onboardingLearnings)
      .where(eq(onboardingLearnings.workspaceId, session.workspaceId))
      .orderBy(
        asc(onboardingLearnings.sortOrder),
        asc(onboardingLearnings.createdAt),
      ),
    db
      .select()
      .from(resourceGroupMembers)
      .where(eq(resourceGroupMembers.userId, session.userId)),
    db
      .select()
      .from(resourceUserAssignments)
      .where(eq(resourceUserAssignments.userId, session.userId)),
    db
      .select()
      .from(resources)
      .where(eq(resources.workspaceId, session.workspaceId)),
  ]);

  // Resolve accessible (non-personal) resources, mirroring the resources page.
  const myGroupIds = new Set(myGroupMemberships.map((m) => m.groupId));

  let groupAssignedResourceIds = new Set<string>();
  if (myGroupIds.size > 0) {
    const groupAssignments = await db.select().from(resourceGroupAssignments);
    groupAssignedResourceIds = new Set(
      groupAssignments
        .filter((a) => myGroupIds.has(a.groupId))
        .map((a) => a.resourceId),
    );
  }

  const directAssignedResourceIds = new Set(
    userAssignments.map((a) => a.resourceId),
  );

  const visibleResources = allResources.filter((r) => {
    if (r.isPersonal) return false;
    if (directAssignedResourceIds.has(r.id)) return true;
    if (groupAssignedResourceIds.has(r.id)) return true;
    return false;
  });

  return (
    <>
      <PageHeader
        title="Welcome 👋"
        description="Everything you need to get started. Work through your paperwork, explore the learning materials, and reach out any time."
      />
      <div className="mx-auto max-w-3xl space-y-8 p-8">
        {/* Paperwork */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Paperwork
          </h2>
          {paperwork.length === 0 ? (
            <EmptyLine />
          ) : (
            <div className="space-y-3">
              {paperwork.map((item) => (
                <PaperworkCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        {/* Learning materials */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Learning materials
          </h2>
          {learnings.length === 0 ? (
            <EmptyLine />
          ) : (
            <div className="space-y-3">
              {learnings.map((item) => (
                <LearningCard key={item.id} learning={item} />
              ))}
            </div>
          )}
        </section>

        {/* Resources */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Resources
          </h2>
          {visibleResources.length === 0 ? (
            <EmptyLine />
          ) : (
            <div className="space-y-3">
              {visibleResources.map((r) => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          )}
        </section>

        {/* Question box */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Questions
          </h2>
          <QuestionBox pageContext="Onboarding portal" />
        </section>
      </div>
    </>
  );
}

function EmptyLine() {
  return <p className="text-sm text-zinc-400">Nothing here yet.</p>;
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
      {children}
    </div>
  );
}

const statusBadge: Record<PaperworkRow["status"], string> = {
  pending:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  submitted:
    "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  approved:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
};

function PaperworkCard({ item }: { item: PaperworkRow }) {
  const uploadAction = submitPaperwork.bind(null, item.id);
  const setDay1Action = setBringsOnDay1.bind(null, item.id);
  const templateHref = item.templateFileUrl || item.templateUrl;

  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {item.title}
              </p>
              {item.description && (
                <p className="mt-0.5 text-sm text-zinc-500">
                  {item.description}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusBadge[item.status]}`}
            >
              {item.status}
            </span>
          </div>

          {templateHref && (
            <a
              href={templateHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              <Download className="h-3.5 w-3.5" />
              Download template
              {item.templateFileName && (
                <span className="font-normal text-zinc-400">
                  ({item.templateFileName})
                </span>
              )}
            </a>
          )}

          {item.status !== "pending" && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-zinc-500">Submitted:</span>
              {item.submittedFileUrl ? (
                <a
                  href={item.submittedFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {item.submittedFileName || "View file"}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {item.submittedFileName || "Saved"}
                </span>
              )}
              {item.status === "approved" && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approved
                </span>
              )}
            </div>
          )}

          {/* "Bring on day one" option — only shown for forms that legally
              require in-person handling (e.g. I-9 document inspection). */}
          {item.allowBringOnDay1 && item.status === "pending" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
              {item.bringsOnDay1 ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                    <CheckCircle2 className="h-4 w-4" />
                    You&apos;ll bring the completed form on your first day
                  </span>
                  <form action={setDay1Action}>
                    <input type="hidden" name="bringsOnDay1" value="false" />
                    <button
                      type="submit"
                      className="text-xs text-zinc-400 underline hover:text-zinc-600"
                    >
                      Undo
                    </button>
                  </form>
                </div>
              ) : (
                <form action={setDay1Action} className="flex items-center gap-2">
                  <input type="hidden" name="bringsOnDay1" value="true" />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    I&apos;ll bring the completed form on day one
                  </button>
                  <span className="text-xs text-amber-600/60 dark:text-amber-500/60">
                    (required in person)
                  </span>
                </form>
              )}
            </div>
          )}

          {/* Upload section — hidden if they've opted to bring on day one */}
          {!item.bringsOnDay1 && (
            <form
              action={uploadAction}
              encType="multipart/form-data"
              className="flex flex-wrap items-center gap-3 pt-1"
            >
              <input
                type="file"
                name="file"
                required
                className="block text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200 dark:hover:file:bg-zinc-700"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {item.status === "pending" ? "Submit form" : "Replace file"}
              </button>
            </form>
          )}
        </div>
      </div>
    </CardShell>
  );
}

function LearningCard({ learning }: { learning: Learning }) {
  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
          <GraduationCap className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            {learning.title}
          </p>
          {learning.description && (
            <p className="mt-0.5 text-sm text-zinc-500">
              {learning.description}
            </p>
          )}
          {learning.type === "link" && learning.url && (
            <a
              href={learning.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {learning.url}
            </a>
          )}
          {learning.type === "text" && learning.body && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {learning.body}
            </p>
          )}
        </div>
      </div>
    </CardShell>
  );
}

function ResourceCard({ resource: r }: { resource: Resource }) {
  const iconBg =
    r.type === "link"
      ? "bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400"
      : r.type === "credential"
        ? "bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400"
        : "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400";

  const Icon =
    r.type === "link" ? Link2 : r.type === "credential" ? KeyRound : BookOpen;

  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            {r.title}
          </p>
          {r.description && (
            <p className="text-sm text-zinc-500">{r.description}</p>
          )}

          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {r.url}
            </a>
          )}

          {r.externalUrl && (
            <a
              href={r.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
          )}

          {r.fileUrl && (
            <a
              href={r.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              <Download className="h-3.5 w-3.5" />
              Download
              {r.fileName && (
                <span className="font-normal text-zinc-400">
                  ({r.fileName})
                </span>
              )}
            </a>
          )}

          {r.type === "credential" && r.username && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
              <span className="w-20 shrink-0 text-xs font-medium text-zinc-500">
                Username
              </span>
              <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                {r.username}
              </span>
            </div>
          )}
          {r.type === "credential" && r.password && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
              <span className="w-20 shrink-0 text-xs font-medium text-zinc-500">
                Password
              </span>
              <span className="font-mono text-sm tracking-widest text-zinc-500">
                {"•".repeat(Math.min(r.password.length, 12))}
              </span>
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}
