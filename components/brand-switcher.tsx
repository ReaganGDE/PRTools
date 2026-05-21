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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = brands.find((b) => b.id === activeBrandId) ?? null;

  function pick(id: string | null) {
    setOpen(false);
    startTransition(async () => { await setActiveBrand(id); });
  }

  return (
    <div ref={ref} className="relative px-2 pb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] font-medium transition-all duration-100 hover:bg-white/5 disabled:opacity-50"
        style={{ color: "var(--sidebar-fg)", border: "1px solid var(--sidebar-border)" }}
      >
        {active ? (
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: active.color }} />
        ) : (
          <Layers className="h-3 w-3 shrink-0 text-zinc-600" />
        )}
        <span className="min-w-0 flex-1 truncate text-zinc-400">
          {active ? active.name : "All brands"}
        </span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-zinc-600 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className="absolute left-2 right-2 top-full z-50 mt-1 overflow-hidden rounded-lg shadow-xl"
          style={{ background: "#18181d", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <DropItem
            icon={<Layers className="h-3.5 w-3.5 text-zinc-500" />}
            label="All brands"
            active={!active}
            onClick={() => pick(null)}
          />
          {brands.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
          )}
          {brands.map((b) => (
            <DropItem
              key={b.id}
              icon={<span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />}
              label={b.name}
              active={active?.id === b.id}
              onClick={() => pick(b.id)}
            />
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
          <Link
            href="/brands"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[12px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          >
            <Plus className="h-3.5 w-3.5" /> Manage brands
          </Link>
        </div>
      )}
    </div>
  );
}

function DropItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors",
        active ? "bg-white/5 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {active && <Check className="h-3.5 w-3.5 text-red-500 shrink-0" />}
    </button>
  );
}
