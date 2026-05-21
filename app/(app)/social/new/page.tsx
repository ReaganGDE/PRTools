import { eq, and, ne, asc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth-helpers";
import {
  getActiveBrandId,
  getBrandsForWorkspace,
} from "@/lib/brand-context";
import { db } from "@/lib/db";
import { movies } from "@/lib/db/schema";
import { NewPostForm } from "./form";

export default async function NewSocialPostPage() {
  const session = await requireSession();
  const [brands, activeBrandId, movieRows] = await Promise.all([
    getBrandsForWorkspace(session.workspaceId),
    getActiveBrandId(),
    db
      .select({ id: movies.id, title: movies.title, brandId: movies.brandId })
      .from(movies)
      .where(
        and(
          eq(movies.workspaceId, session.workspaceId),
          ne(movies.status, "archived"),
        ),
      )
      .orderBy(asc(movies.title)),
  ]);

  return (
    <>
      <PageHeader
        title="New social post"
        description="Compose, post now, or schedule for later."
      />
      <div className="p-8">
        <NewPostForm
          brands={brands.map((b) => ({ id: b.id, name: b.name, color: b.color }))}
          movies={movieRows.map((m) => ({
            id: m.id,
            title: m.title,
            brandId: m.brandId,
          }))}
          defaultBrandId={activeBrandId}
        />
      </div>
    </>
  );
}
