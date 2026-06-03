"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateFollowUpDays } from "./actions";

export function FollowUpDaysForm({ defaultValue }: { defaultValue: number }) {
  const [days, setDays] = useState(defaultValue);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updateFollowUpDays(days);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <label className="text-sm text-zinc-700 dark:text-zinc-300">
        Follow-up reminder after
      </label>
      <input
        type="number"
        min={1}
        max={30}
        value={days}
        onChange={(e) => { setDays(Number(e.target.value)); setSaved(false); }}
        className="h-8 w-16 rounded-md border border-zinc-200 bg-white px-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950"
      />
      <span className="text-sm text-zinc-500">days</span>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
      {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>}
    </form>
  );
}
