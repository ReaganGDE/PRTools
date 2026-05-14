import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageTemplates } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmailTemplateForm } from "@/components/email-template-form";
import { updateTemplate, deleteTemplate } from "../../actions";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [template] = await db
    .select()
    .from(messageTemplates)
    .where(
      and(
        eq(messageTemplates.id, id),
        eq(messageTemplates.workspaceId, session.workspaceId),
      ),
    );
  if (!template) notFound();

  const boundUpdate = updateTemplate.bind(null, template.id);
  const boundDelete = deleteTemplate.bind(null, template.id);

  return (
    <>
      <PageHeader
        title={template.name}
        description="Edit email template."
        actions={
          <form action={boundDelete}>
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </form>
        }
      />
      <div className="p-8">
        <EmailTemplateForm
          action={boundUpdate}
          initial={{
            name: template.name,
            subject: template.subject ?? "",
            body: template.body,
          }}
          submitLabel="Save changes"
        />
      </div>
    </>
  );
}
