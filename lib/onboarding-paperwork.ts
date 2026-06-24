import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  onboardingPaperwork,
  onboardingPaperworkTemplates,
} from "@/lib/db/schema";

// The standard new-hire packet, split from the uploaded "New Employee Packet"
// PDF and served as static files from /public/onboarding. These are seeded once
// per workspace (only when no templates exist yet) so an admin can edit/remove
// them afterwards without them reappearing.
export const DEFAULT_PAPERWORK_TEMPLATES: {
  title: string;
  description: string;
  templateFileUrl: string;
  templateFileName: string;
  sortOrder: number;
  allowBringOnDay1: boolean;
}[] = [
  {
    title: "New Hire Form",
    description: "Basic employee information — print clearly in blue or black ink.",
    templateFileUrl: "/onboarding/01-new-hire-form.pdf",
    templateFileName: "New Hire Form.pdf",
    sortOrder: 0,
    allowBringOnDay1: false,
  },
  {
    title: "Form W-4 — Employee's Withholding Certificate",
    description:
      "Federal tax withholding. Complete so we withhold the correct federal income tax from your pay.",
    templateFileUrl: "/onboarding/02-w4-withholding-certificate.pdf",
    templateFileName: "Form W-4.pdf",
    sortOrder: 1,
    allowBringOnDay1: false,
  },
  {
    title: "Ohio Form IT-4 — Withholding Exemption Certificate",
    description: "Ohio state tax withholding exemption certificate.",
    templateFileUrl: "/onboarding/03-ohio-it4-withholding-exemption.pdf",
    templateFileName: "Ohio IT-4.pdf",
    sortOrder: 2,
    allowBringOnDay1: false,
  },
  {
    // The I-9 requires the employer to physically inspect original identity/work-
    // authorization documents in person — a digital upload satisfies the form
    // itself but cannot replace the in-person document examination (8 U.S.C.
    // § 1324a). "Bring on day one" is therefore the legally-correct workflow.
    title: "Form I-9 — Employment Eligibility Verification",
    description:
      "Confirms your identity and authorization to work in the U.S. You must bring original documents (List A, or List B + C) on your first day for in-person verification.",
    templateFileUrl: "/onboarding/04-i9-employment-eligibility.pdf",
    templateFileName: "Form I-9.pdf",
    sortOrder: 3,
    allowBringOnDay1: true,
  },
  {
    title: "Ohio New Hire Reporting",
    description: "State-required new hire reporting form.",
    templateFileUrl: "/onboarding/05-ohio-new-hire-reporting.pdf",
    templateFileName: "Ohio New Hire Reporting.pdf",
    sortOrder: 4,
    allowBringOnDay1: false,
  },
  {
    title: "Direct Deposit Authorization",
    description:
      "Authorize payroll direct deposit. Attach a voided check or bank letter.",
    templateFileUrl: "/onboarding/06-direct-deposit-authorization.pdf",
    templateFileName: "Direct Deposit Authorization.pdf",
    sortOrder: 5,
    allowBringOnDay1: false,
  },
];

// Seed the standard packet for a workspace the first time (only when the
// workspace has zero templates). Idempotent and safe to call on every load.
export async function ensureDefaultPaperworkTemplates(workspaceId: string) {
  const existing = await db
    .select({ id: onboardingPaperworkTemplates.id })
    .from(onboardingPaperworkTemplates)
    .where(eq(onboardingPaperworkTemplates.workspaceId, workspaceId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(onboardingPaperworkTemplates).values(
    DEFAULT_PAPERWORK_TEMPLATES.map((t) => ({
      workspaceId,
      title: t.title,
      description: t.description,
      templateFileUrl: t.templateFileUrl,
      templateFileName: t.templateFileName,
      sortOrder: t.sortOrder,
      allowBringOnDay1: t.allowBringOnDay1,
    })),
  );
}

// Instantiate a paperwork row for the given onboardee for every template they
// don't already have one for. Returns nothing; callers re-query afterwards.
export async function ensurePaperworkForUser(
  userId: string,
  workspaceId: string,
) {
  const [templates, existing] = await Promise.all([
    db
      .select()
      .from(onboardingPaperworkTemplates)
      .where(eq(onboardingPaperworkTemplates.workspaceId, workspaceId))
      .orderBy(asc(onboardingPaperworkTemplates.sortOrder)),
    db
      .select({ templateId: onboardingPaperwork.templateId })
      .from(onboardingPaperwork)
      .where(
        and(
          eq(onboardingPaperwork.userId, userId),
          eq(onboardingPaperwork.workspaceId, workspaceId),
          isNotNull(onboardingPaperwork.templateId),
        ),
      ),
  ]);

  if (templates.length === 0) return;

  const have = new Set(existing.map((e) => e.templateId));
  const missing = templates.filter((t) => !have.has(t.id));
  if (missing.length === 0) return;

  await db.insert(onboardingPaperwork).values(
    missing.map((t) => ({
      workspaceId,
      userId,
      templateId: t.id,
      title: t.title,
      description: t.description,
      templateUrl: t.templateUrl,
      templateFileUrl: t.templateFileUrl,
      templateFileName: t.templateFileName,
      status: "pending" as const,
    })),
  );
}
