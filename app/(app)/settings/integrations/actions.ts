"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { listBases, listTables } from "@/lib/integrations/airtable";

export async function saveAirtableConfig(formData: FormData) {
  const session = await requireSession();
  const tokenRaw = String(formData.get("token") ?? "").trim();
  const baseId = String(formData.get("baseId") ?? "").trim() || null;

  // Empty token means "keep existing" — only update if user typed a new one.
  // Pasting an empty string + saving will not clear by accident.
  const token = tokenRaw.length > 0 ? tokenRaw : undefined;

  await db
    .update(workspaces)
    .set({
      ...(token !== undefined ? { airtableToken: token } : {}),
      airtableBaseId: baseId,
    })
    .where(eq(workspaces.id, session.workspaceId));

  revalidatePath("/settings/integrations");
}

export async function clearAirtableConfig() {
  const session = await requireSession();
  await db
    .update(workspaces)
    .set({ airtableToken: null, airtableBaseId: null })
    .where(eq(workspaces.id, session.workspaceId));
  revalidatePath("/settings/integrations");
}

// Used by the brand settings to populate a dropdown of available tables.
export async function listAirtableTables(): Promise<
  { id: string; name: string }[]
> {
  const session = await requireSession();
  const [ws] = await db
    .select({ token: workspaces.airtableToken, baseId: workspaces.airtableBaseId })
    .from(workspaces)
    .where(eq(workspaces.id, session.workspaceId));
  if (!ws?.token || !ws?.baseId) return [];
  try {
    const tables = await listTables(ws.token, ws.baseId);
    return tables.map((t) => ({ id: t.id, name: t.name }));
  } catch {
    return [];
  }
}

// Test a token by listing accessible bases. Returns base list on success.
export async function testAirtableToken(
  token: string,
): Promise<{ ok: true; bases: { id: string; name: string }[] } | { ok: false; error: string }> {
  await requireSession();
  if (!token.trim()) return { ok: false, error: "Token is empty." };
  try {
    const bases = await listBases(token.trim());
    return { ok: true, bases };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
