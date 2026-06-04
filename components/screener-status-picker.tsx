"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { updateScreenerStatus } from "@/app/(app)/movies/[id]/press-actions";
import type { ScreenerStatus } from "@/app/(app)/movies/[id]/press-actions";

const STATUSES: { value: ScreenerStatus; label: string; chip: string; dot: string }[] = [
  { value: "not_requested", label: "Not requested", chip: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400", dot: "bg-zinc-300" },
  { value: "requested",     label: "Requested",     chip: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", dot: "bg-blue-500" },
  { value: "approved",      label: "Approved",      chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", dot: "bg-amber-500" },
  { value: "sent",          label: "Sent",           chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  { value: "declined",      label: "Declined",       chip: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300", dot: "bg-red-400" },
];

export function ScreenerStatusPicker({
  movieId,
  contactId,
  initialStatus,
}: {
  movieId: string;
  contactId: string;
  initialStatus: ScreenerStatus;
}) {
  const [status, setStatus] = useState<ScreenerStatus>(initialStatus);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(next: ScreenerStatus) {
    setOpen(false);
    setStatus(next);
    startTransition(async () => {
      await updateScreenerStatus(movieId, contactId, next);
    });
  }

  const current = STATUSES.find((s) => s.value === status) ?? STATUSES[0];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${current.chip} disabled:opacity-50`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
        {current.label}
        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => pick(s.value)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${s.value === status ? "font-semibold" : ""}`}
            >
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
