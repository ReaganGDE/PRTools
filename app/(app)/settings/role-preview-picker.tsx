"use client";
import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPreviewRole } from "./actions";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";

const PREVIEW_ROLES: Role[] = ["admin", "member", "viewer"];

export function RolePreviewPicker({
  actualRole,
}: {
  actualRole: Role;
}) {
  const [selected, setSelected] = useState<Role>("member");
  const [isPending, startTransition] = useTransition();

  // Only show roles genuinely lower than the caller's actual role.
  const available = PREVIEW_ROLES.filter(
    (r) => r !== actualRole && PREVIEW_ROLES.includes(r),
  );

  if (available.length === 0) {
    return <p className="text-sm text-zinc-500">No lower roles available to preview.</p>;
  }

  function activate() {
    startTransition(async () => {
      await setPreviewRole(selected);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {available.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setSelected(r)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              selected === r
                ? "border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-950/30 dark:text-red-400"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            }`}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">{ROLE_DESCRIPTIONS[selected]}</p>
      <Button type="button" size="sm" onClick={activate} disabled={isPending}>
        <Eye className="h-3.5 w-3.5" />
        {isPending ? "Activating…" : `View as ${ROLE_LABELS[selected]}`}
      </Button>
    </div>
  );
}
