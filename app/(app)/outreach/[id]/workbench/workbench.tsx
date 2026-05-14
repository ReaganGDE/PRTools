"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DeepLinkResult, Platform } from "@/lib/outreach/deep-links";
import { markOutcome } from "../../actions";

export function Workbench({
  campaignId,
  contactId,
  contactName,
  contactOutlet,
  contactBeat,
  contactFollowers,
  contactHandle,
  rendered,
  renderedSubject,
  platform,
  link,
  sentCount,
  total,
}: {
  campaignId: string;
  contactId: string;
  contactName: string;
  contactOutlet: string | null;
  contactBeat: string | null;
  contactFollowers: number | null;
  contactHandle: string | null;
  rendered: string;
  renderedSubject: string | null;
  platform: Platform;
  link: DeepLinkResult;
  sentCount: number;
  total: number;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(rendered);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard might be blocked; ignore
    }
    if (link.url) {
      window.open(link.url, "_blank", "noopener,noreferrer");
      setOpened(true);
    }
  }

  function mark(action: "sent" | "skipped") {
    startTransition(async () => {
      await markOutcome({
        campaignId,
        contactId,
        action,
        renderedBody: rendered,
        renderedSubject: renderedSubject ?? undefined,
      });
      setOpened(false);
      setCopied(false);
      router.refresh();
    });
  }

  // Keyboard shortcuts: C = copy & open, S = mark sent, N = skip
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        copyAndOpen();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        mark("sent");
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        mark("skipped");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, link.url]);

  const progressPct = total > 0 ? (sentCount / total) * 100 : 0;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Progress</span>
            <span>
              {sentCount} / {total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-zinc-900 transition-all dark:bg-zinc-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Next up
                </div>
                <h2 className="mt-1 text-xl font-semibold">{contactName}</h2>
                <p className="text-sm text-zinc-500">
                  {[
                    contactHandle && `@${contactHandle}`,
                    contactOutlet,
                    contactBeat,
                    contactFollowers
                      ? `${contactFollowers.toLocaleString()} followers`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {platform}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderedSubject ? (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Subject
                </div>
                <div className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                  {renderedSubject}
                </div>
              </div>
            ) : null}
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Message
              </div>
              <pre className="mt-1 whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm font-sans dark:border-zinc-800 dark:bg-zinc-900">
                {rendered}
              </pre>
            </div>

            {link.url ? (
              <Button
                onClick={copyAndOpen}
                size="lg"
                className="w-full"
                disabled={pending}
              >
                {copied ? "✓ Copied — " : ""}
                {link.prefilled
                  ? "Open (pre-filled) ↗"
                  : "Copy & open ↗"}
                <span className="ml-2 text-xs opacity-60">[C]</span>
              </Button>
            ) : (
              <div className="rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                {link.unavailableReason ?? "Can't reach this contact on this platform."}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => mark("sent")}
                variant="default"
                className="flex-1"
                disabled={pending}
              >
                Mark sent
                <span className="ml-2 text-xs opacity-60">[S]</span>
              </Button>
              <Button
                onClick={() => mark("skipped")}
                variant="outline"
                className="flex-1"
                disabled={pending}
              >
                Skip
                <span className="ml-2 text-xs opacity-60">[N]</span>
              </Button>
            </div>

            {opened ? (
              <p className="text-center text-xs text-zinc-500">
                Tab opened in background. Paste, send, then come back and click <strong>Mark sent</strong>.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Keyboard: <kbd>C</kbd> copy &amp; open · <kbd>S</kbd> mark sent ·{" "}
          <kbd>N</kbd> skip
        </p>
      </div>
    </div>
  );
}
