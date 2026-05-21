import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth-helpers";
import {
  getActiveBrandId,
  getBrandsForWorkspace,
} from "@/lib/brand-context";
import { NewPostForm } from "./form";

export default async function NewSocialPostPage() {
  const session = await requireSession();
  const [brands, activeBrandId] = await Promise.all([
    getBrandsForWorkspace(session.workspaceId),
    getActiveBrandId(),
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
          defaultBrandId={activeBrandId}
        />
      </div>
    </>
  );
}
