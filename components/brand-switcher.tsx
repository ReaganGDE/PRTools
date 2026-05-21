"use client";
import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, Layers, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { setActiveBrand } from "@/app/(app)/brands/actions";

export type BrandOption = {
  id: string;
  name: string;
  color: string;
  type: string;
};

export function BrandSwitcher({
  brands,
  activeBrandId,
}: {
  brands: BrandOption[];
  activeBrandId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = brands.find((b) => b.id === activeBrandId) ?? null;

  function pick(id: string | null) {
    setOpen(false);
    startTransition(async () => {
      await setActiveBrand(id);
    });
  }

  return (
    <div ref={ref} className="relative px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-left text-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800",
        )}
      >
        {active ? (
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: active.color }}
          />
        ) : (
          <Layers className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {active ? active.name : "All brands"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={() => pick(null)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900",
              !active && "bg-zinc-50 dark:bg-zinc-900",
            )}
          >
            <Layers className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span className="flex-1 text-left">All brands</span>
            {!active && <Check className="h-3.5 w-3.5 text-red-600" />}
          </button>
          <div className="border-t border-zinc-100 dark:border-zinc-800/60" />
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => pick(b.id)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900",
                active?.id === b.id && "bg-zinc-50 dark:bg-zinc-900",
              )}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: b.color }}
              />
              <span className="flex-1 truncate text-left">{b.name}</span>
              {active?.id === b.id && (
                <Check className="h-3.5 w-3.5 text-red-600" />
              )}
            </button>
          ))}
          <div className="border-t border-zinc-100 dark:border-zinc-800/60" />
          <Link
            href="/brands"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Manage brands
          </Link>
        </div>
      )}
    </div>
  );
}
