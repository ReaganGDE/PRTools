import { PageHeader } from "@/components/page-header";
import { NewPostForm } from "./form";

export default function NewSocialPostPage() {
  return (
    <>
      <PageHeader
        title="New social post"
        description="Compose, post now, or schedule for later."
      />
      <div className="p-8">
        <NewPostForm />
      </div>
    </>
  );
}
