import { put } from "@vercel/blob";
import { env } from "@/lib/env";

export type StoredFile = {
  url: string;
  name: string;
  backend: "sharepoint" | "blob";
};

export type PaperworkUploadMeta = {
  paperworkId: string;
  documentTitle: string;
  employeeName: string;
  employeeEmail: string | null;
};

// Strip characters that are illegal in SharePoint/Windows file & folder names.
function sanitizeSegment(s: string): string {
  return (
    s
      .replace(/[\\/:*?"<>|#%]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Untitled"
  );
}

// POST the file to the Power Automate / Make.com webhook, which saves it to a
// SharePoint folder and (ideally) returns the resulting file URL. Returns null
// on any failure so the caller can fall back to Blob.
async function uploadToSharePoint(
  file: File,
  meta: PaperworkUploadMeta,
): Promise<StoredFile | null> {
  const webhook = env.SHAREPOINT_UPLOAD_WEBHOOK_URL;
  if (!webhook) return null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = sanitizeSegment(meta.employeeName || meta.employeeEmail || "Onboarding");
    const baseName = sanitizeSegment(meta.documentTitle);
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const fileName = ext && !baseName.endsWith(ext) ? `${baseName}${ext}` : baseName;

    const payload = {
      fileName,
      folder, // suggested per-employee folder; the flow decides the library/root
      contentType: file.type || "application/octet-stream",
      contentBase64: buffer.toString("base64"),
      employeeName: meta.employeeName,
      employeeEmail: meta.employeeEmail,
      documentTitle: meta.documentTitle,
      originalFileName: file.name,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.error(
        `SharePoint webhook returned ${res.status} ${res.statusText}`,
      );
      return null;
    }

    // The flow's Response action should return JSON with the saved file's URL.
    // Be lenient about the field name.
    let url: string | undefined;
    try {
      const json = (await res.json()) as Record<string, unknown>;
      url =
        (json.url as string) ||
        (json.webUrl as string) ||
        (json.WebUrl as string) ||
        (json.link as string) ||
        (json.Link as string) ||
        undefined;
    } catch {
      // No/invalid JSON body — treat as success but with no link back.
      url = undefined;
    }

    return {
      url: url ?? "",
      name: fileName,
      backend: "sharepoint",
    };
  } catch (err) {
    console.error("SharePoint upload failed, falling back to Blob", err);
    return null;
  }
}

async function uploadToBlob(
  file: File,
  meta: PaperworkUploadMeta,
): Promise<StoredFile> {
  const blob = await put(
    `onboarding-paperwork/${meta.paperworkId}-${file.name}`,
    file,
    { access: "public", addRandomSuffix: true },
  );
  return { url: blob.url, name: file.name, backend: "blob" };
}

// Store a completed onboarding document: SharePoint when the webhook is
// configured and succeeds, otherwise Vercel Blob.
export async function storeCompletedPaperwork(
  file: File,
  meta: PaperworkUploadMeta,
): Promise<StoredFile> {
  const sharePoint = await uploadToSharePoint(file, meta);
  if (sharePoint) return sharePoint;
  return uploadToBlob(file, meta);
}
