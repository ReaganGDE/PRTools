import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { onboardingPaperwork } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireSessionWithCap("onboarding.view");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Admins/owners can download anyone's paperwork in their workspace;
  // regular users can only download their own.
  const isAdmin = session.role === "owner" || session.role === "admin";

  const [row] = await db
    .select({
      submittedFileData: onboardingPaperwork.submittedFileData,
      submittedFileContentType: onboardingPaperwork.submittedFileContentType,
      submittedFileName: onboardingPaperwork.submittedFileName,
      userId: onboardingPaperwork.userId,
      workspaceId: onboardingPaperwork.workspaceId,
    })
    .from(onboardingPaperwork)
    .where(
      isAdmin
        ? and(
            eq(onboardingPaperwork.id, id),
            eq(onboardingPaperwork.workspaceId, session.workspaceId),
          )
        : and(
            eq(onboardingPaperwork.id, id),
            eq(onboardingPaperwork.userId, session.userId),
            eq(onboardingPaperwork.workspaceId, session.workspaceId),
          ),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!row.submittedFileData) {
    return NextResponse.json({ error: "No file stored" }, { status: 404 });
  }

  const buffer = Buffer.from(row.submittedFileData, "base64");
  const contentType = row.submittedFileContentType ?? "application/octet-stream";
  const filename = row.submittedFileName ?? "document";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
