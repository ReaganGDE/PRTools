"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { resources, resourceDepartments, departments } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const ResourceInput = z.object({
  name: z.string().trim().min(1),
  url: z
    .string()
    .trim()
    .min(1)
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`)),
  username: z.string().trim().optional(),
  password: z.string().optional(),
  notes: z.string().trim().optional(),
});

function departmentIdsFrom(formData: FormData): string[] {
  return formData.getAll("departments").map(String).filter(Boolean);
}

async function setResourceDepartments(
  resourceId: string,
  workspaceId: string,
  departmentIds: string[],
) {
  await db
    .delete(resourceDepartments)
    .where(eq(resourceDepartments.resourceId, resourceId));
  if (departmentIds.length === 0) return;
  // Only accept departments that belong to this workspace.
  const valid = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.workspaceId, workspaceId));
  const validIds = new Set(valid.map((d) => d.id));
  const rows = departmentIds
    .filter((id) => validIds.has(id))
    .map((departmentId) => ({ resourceId, departmentId }));
  if (rows.length > 0) await db.insert(resourceDepartments).values(rows);
}

export async function createResource(formData: FormData) {
  const session = await requireSessionWithCap("resources.manage");
  const parsed = ResourceInput.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    username: formData.get("username") ?? undefined,
    password: formData.get("password") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  const [created] = await db
    .insert(resources)
    .values({
      workspaceId: session.workspaceId,
      name: parsed.name,
      url: parsed.url,
      username: parsed.username || null,
      passwordEncrypted: parsed.password ? encryptSecret(parsed.password) : null,
      notes: parsed.notes || null,
      createdBy: session.userId,
    })
    .returning({ id: resources.id });
  await setResourceDepartments(
    created.id,
    session.workspaceId,
    departmentIdsFrom(formData),
  );
  revalidatePath("/resources");
}

export async function updateResource(resourceId: string, formData: FormData) {
  const session = await requireSessionWithCap("resources.manage");
  const parsed = ResourceInput.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    username: formData.get("username") ?? undefined,
    password: formData.get("password") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  const [existing] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(
      and(
        eq(resources.id, resourceId),
        eq(resources.workspaceId, session.workspaceId),
      ),
    );
  if (!existing) throw new Error("Resource not found");

  await db
    .update(resources)
    .set({
      name: parsed.name,
      url: parsed.url,
      username: parsed.username || null,
      notes: parsed.notes || null,
      // Leaving the password field blank keeps the stored one.
      ...(parsed.password
        ? { passwordEncrypted: encryptSecret(parsed.password) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(resources.id, resourceId));
  await setResourceDepartments(
    resourceId,
    session.workspaceId,
    departmentIdsFrom(formData),
  );
  revalidatePath("/resources");
}

export async function deleteResource(resourceId: string) {
  const session = await requireSessionWithCap("resources.manage");
  await db
    .delete(resources)
    .where(
      and(
        eq(resources.id, resourceId),
        eq(resources.workspaceId, session.workspaceId),
      ),
    );
  revalidatePath("/resources");
}

/**
 * Decrypts a stored password on demand. The password never rides along in
 * the page payload — only this capability-checked action returns it.
 */
export async function revealPassword(resourceId: string): Promise<string> {
  const session = await requireSessionWithCap("resources.reveal");
  const [row] = await db
    .select({ passwordEncrypted: resources.passwordEncrypted })
    .from(resources)
    .where(
      and(
        eq(resources.id, resourceId),
        eq(resources.workspaceId, session.workspaceId),
      ),
    );
  if (!row) throw new Error("Resource not found");
  if (!row.passwordEncrypted) throw new Error("No password stored");
  return decryptSecret(row.passwordEncrypted);
}
