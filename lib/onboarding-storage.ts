"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { onboardingPaperwork } from "@/lib/db/schema";

export type StoredFile = {
  url: string;
  name: string;
  backend: "db";
};

export type PaperworkUploadMeta = {
  paperworkId: string;
  documentTitle: string;
  employeeName: string;
  employeeEmail: string | null;
};

// Store the completed document as base64 in the database row.
// No external service required — files are retrieved via /api/paperwork/[id]/download.
export async function storeCompletedPaperwork(
  file: File,
  meta: PaperworkUploadMeta,
): Promise<StoredFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const contentType = file.type || "application/octet-stream";

  await db
    .update(onboardingPaperwork)
    .set({
      submittedFileData: base64,
      submittedFileContentType: contentType,
    })
    .where(eq(onboardingPaperwork.id, meta.paperworkId));

  return {
    url: `/api/paperwork/${meta.paperworkId}/download`,
    name: file.name,
    backend: "db",
  };
}
