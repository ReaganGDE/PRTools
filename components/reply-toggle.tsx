"use client";
import { useState, useTransition } from "react";
import { MessageSquareReply, Check, Undo2 } from "lucide-react";
import { markSendReplied } from "@/lib/sends-actions";

/**
 * Toggle a send's replied state. Two visual modes:
 *  - "mark": compact button shown where a reply is expected (pitch report,
 *    contact history). Click → marks replied, then collapses to a "Replied"
 *    chip with an undo.
 *  - "chip": shows a "Replied" chip with undo (used where already replied).
 */
export function ReplyToggle({
  sendId,
  initialReplied,
  onMarked,
}: {
  sendId: string;
  initialReplied: boolean;
  onMarked?: (replied: boolean) => void;
}) {
  const [replied, setReplied] = useState(initialReplied);
  const [isPending, startTransition] = useTransition();

  function toggle(next: boolean) {
    // optimistic
    setReplied(next);
    startTransition(async () => {
      const res = await markSendReplied(sendId, next);
      if (!res.ok) setReplied(!next);
      else onMarked?.(next);
    });
  }

  if (replied) {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check className="h-3 w-3" /> Replied
        </span>
        <button
          type="button"
          onClick={() => toggle(false)}
          disabled={isPending}
          title="Undo — mark as not replied"
          className="text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(true)}
      disabled={isPending}
      className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-emerald-800 dark:hover:text-emerald-300"
    >
      <MessageSquareReply className="h-3 w-3" />
      {isPending ? "Saving…" : "Mark replied"}
    </button>
  );
}
