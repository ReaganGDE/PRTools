"use client";
import { Eye } from "lucide-react";
import { stopImpersonation } from "@/app/(app)/settings/onboarding/actions";

export function ImpersonationBanner({ userEmail }: { userEmail: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Viewing as <strong className="ml-1">{userEmail}</strong>
      </span>
      <form action={stopImpersonation}>
        <button
          type="submit"
          className="rounded px-3 py-1 text-xs bg-white/20 hover:bg-white/30 transition-colors"
        >
          Stop previewing
        </button>
      </form>
    </div>
  );
}
