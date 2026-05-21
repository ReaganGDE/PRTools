"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePost, retryPost } from "../actions";

type Props = {
  postId: string;
  status: string;
  title: string | null;
  body: string;
  scheduledAt: Date | null;
  hasTitle: boolean;
};

export function EditPostForm({
  postId,
  status,
  title,
  body,
  scheduledAt,
  hasTitle,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isRetrying, startRetry] = useTransition();

  const canEdit = status === "draft" || status === "scheduled" || status === "failed";

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updatePost(postId, fd);
    });
  }

  function handleRetry() {
    startRetry(async () => {
      await retryPost(postId);
    });
  }

  if (!canEdit) return null;

  const busy = isPending || isRetrying;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800/60">
        <h2 className="text-sm font-semibold">Edit post</h2>
      </div>
      <form onSubmit={handleSave} className="grid gap-4 p-5">
        {hasTitle && (
          <div className="grid gap-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              name="title"
              defaultValue={title ?? ""}
              maxLength={300}
              disabled={busy}
            />
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="edit-body">Caption</Label>
          <textarea
            id="edit-body"
            name="body"
            required
            rows={6}
            defaultValue={body}
            disabled={busy}
            className="rounded-md border border-zinc-200 bg-white p-3 text-sm transition-colors focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/30 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>

        {status === "scheduled" && scheduledAt && (
          <div className="grid gap-1.5">
            <Label htmlFor="edit-schedule">Scheduled time</Label>
            <Input
              id="edit-schedule"
              type="datetime-local"
              name="scheduledAt"
              defaultValue={scheduledAt.toISOString().slice(0, 16)}
              disabled={busy}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" disabled={busy}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
          {status === "failed" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRetry}
              disabled={busy}
            >
              {isRetrying ? "Retrying…" : "Retry post"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
