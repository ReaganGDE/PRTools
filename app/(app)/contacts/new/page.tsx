import { PageHeader } from "@/components/page-header";
import { ContactForm } from "@/components/contact-form";
import { createContact } from "../actions";

export default function NewContactPage() {
  return (
    <>
      <PageHeader title="Add contact" description="Manual entry." />
      <div className="p-8">
        <ContactForm action={createContact} submitLabel="Create contact" />
      </div>
    </>
  );
}
