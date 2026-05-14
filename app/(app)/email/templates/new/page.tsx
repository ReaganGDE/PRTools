import { PageHeader } from "@/components/page-header";
import { EmailTemplateForm } from "@/components/email-template-form";
import { createTemplate } from "../../actions";

export default function NewTemplatePage() {
  return (
    <>
      <PageHeader title="New email template" />
      <div className="p-8">
        <EmailTemplateForm action={createTemplate} submitLabel="Create template" />
      </div>
    </>
  );
}
