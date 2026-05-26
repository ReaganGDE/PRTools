"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brands } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";

export async function setActiveBrand(brandId: string | null) {
  const jar = await cookies();
  jar.set("active_brand", brandId ?? "all", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

export async function createBrand(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "company") as
    | "company"
    | "streaming"
    | "label";
  const color = String(formData.get("color") ?? "#dc2626");
  if (!name) throw new Error("Brand name is required");

  await db.insert(brands).values({
    workspaceId: session.workspaceId,
    name,
    type,
    color,
  });
  revalidatePath("/", "layout");
}

export async function updateBrand(brandId: string, formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#dc2626");
  const active = formData.get("active") === "on";
  const airtableTableId =
    (formData.get("airtableTableId") as string | null)?.trim() || null;
  if (!name) throw new Error("Brand name is required");

  await db
    .update(brands)
    .set({ name, color, active, airtableTableId })
    .where(
      and(eq(brands.id, brandId), eq(brands.workspaceId, session.workspaceId)),
    );
  revalidatePath("/", "layout");
  revalidatePath("/brands");
}
