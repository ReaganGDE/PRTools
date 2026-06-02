import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "./import-wizard";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import contacts"
        description="Upload a CSV and map columns. Dedups by email."
      />
      <div className="p-8">
        <ImportWizard />
      </div>
    </>
  );
}
