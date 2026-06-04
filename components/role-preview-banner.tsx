import { Eye, X } from "lucide-react";
import { clearPreviewRole } from "@/app/(app)/settings/actions";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export function RolePreviewBanner({
  previewRole,
  actualRole,
}: {
  previewRole: Role;
  actualRole: Role;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Previewing as <strong>{ROLE_LABELS[previewRole]}</strong>
        <span className="opacity-70">
          (your actual role: {ROLE_LABELS[actualRole]})
        </span>
      </span>
      <form action={clearPreviewRole}>
        <button
          type="submit"
          className="flex items-center gap-1 rounded-md bg-amber-600/30 px-2.5 py-1 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-600/50"
        >
          <X className="h-3.5 w-3.5" /> Exit preview
        </button>
      </form>
    </div>
  );
}
