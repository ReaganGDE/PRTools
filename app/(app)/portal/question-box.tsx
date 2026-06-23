"use client";

import { useState, useTransition } from "react";
import { MessageCircleQuestion, Check, Send } from "lucide-react";
import { submitQuestion } from "./actions";

export function QuestionBox({ pageContext }: { pageContext?: string }) {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const question = value.trim();
    if (!question || isPending) return;

    const formData = new FormData();
    formData.set("question", question);
    if (pageContext) formData.set("pageContext", pageContext);

    startTransition(async () => {
      await submitQuestion(formData);
      setValue("");
      setSent(true);
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-500 dark:bg-violet-950/40 dark:text-violet-400">
          <MessageCircleQuestion className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            Have a question?
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Send it to your team — they&apos;ll get an email and follow up.
          </p>

          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <input type="hidden" name="pageContext" value={pageContext ?? ""} />
            <textarea
              name="question"
              required
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (sent) setSent(false);
              }}
              placeholder="Ask anything about your onboarding…"
              className="min-h-[90px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            />

            <div className="flex items-center justify-between gap-3">
              {sent ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  Sent! Your team has been notified.
                </span>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={isPending || value.trim().length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                <Send className="h-4 w-4" />
                {isPending ? "Sending…" : "Send question"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
