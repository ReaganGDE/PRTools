"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPost } from "../actions";

const PLATFORMS = [
  { value: "reddit", label: "Reddit", working: true },
  { value: "youtube", label: "YouTube", working: false },
  { value: "facebook", label: "Facebook Page", working: false },
  { value: "instagram", label: "Instagram", working: false },
] as const;

type PlatformValue = (typeof PLATFORMS)[number]["value"];

export function NewPostForm({
  memberNeedsApproval,
  approvers,
  defaultApproverId,
  canPublishDirectly,
}: {
  memberNeedsApproval: boolean;
  approvers: { id: string; name: string | null; email: string; role: string }[];
  defaultApproverId: string | null;
  canPublishDirectly: boolean;
}) {
  const [selected, setSelected] = useState<Set<PlatformValue>>(
    new Set(["reddit"]),
  );
  const [scheduled, setScheduled] = useState(false);

  function toggle(p: PlatformValue) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  const needsReddit = selected.has("reddit");

  return (
    <form action={createPost} className="grid max-w-2xl gap-4">
      <div className="grid gap-2">
        <Label>Platforms (pick one or many)</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLATFORMS.map((p) => (
            <label
              key={p.value}
              className={`relative cursor-pointer rounded-md border p-3 text-sm ${
                selected.has(p.value)
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              }`}
            >
              <input
                type="checkbox"
                name="platforms"
                value={p.value}
                checked={selected.has(p.value)}
                onChange={() => toggle(p.value)}
                className="sr-only"
              />
              <div className="font-medium">{p.label}</div>
              {!p.working ? (
                <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Stub
                </div>
              ) : null}
            </label>
          ))}
        </div>
        {selected.size === 0 ? (
          <p className="text-xs text-red-600">Pick at least one platform.</p>
        ) : null}
      </div>

      {needsReddit ? (
        <fieldset className="grid gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Reddit-specific
          </legend>
          <div className="grid gap-2">
            <Label htmlFor="subreddit">Subreddit (without r/)</Label>
            <Input
              id="subreddit"
              name="subreddit"
              required
              placeholder="movies"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={300} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="linkUrl">Link URL (optional)</Label>
            <Input
              id="linkUrl"
              name="linkUrl"
              type="url"
              placeholder="https://… (leave blank for a text post)"
            />
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="body">Body</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={8}
          className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          placeholder="What do you want to say?"
        />
        {selected.size > 1 ? (
          <p className="text-xs text-zinc-500">
            Same body posts to all selected platforms. Use the platform-specific
            section above for Reddit only.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={scheduled}
            onChange={(e) => setScheduled(e.target.checked)}
          />
          Schedule for later
        </Label>
        {scheduled ? (
          <Input
            type="datetime-local"
            name="scheduledAt"
            required
            min={new Date().toISOString().slice(0, 16)}
          />
        ) : null}
      </div>

      {memberNeedsApproval ? (
        <fieldset className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Approval required
          </legend>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            Your workspace requires admin approval before posts publish.
          </p>
          {approvers.length > 0 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="requestedApproverId">Send to</Label>
              <select
                id="requestedApproverId"
                name="requestedApproverId"
                defaultValue={defaultApproverId ?? ""}
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">— Any admin / owner —</option>
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.email} ({a.role})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </fieldset>
      ) : (
        <fieldset className="grid gap-1.5 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Optional: send to teammate for review
          </legend>
          <select
            name="requestedApproverId"
            defaultValue=""
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">— No approval needed —</option>
            {approvers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.email} ({a.role})
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">
            Pick someone to send this for review. Leave as &quot;none&quot; to
            publish/schedule directly.
          </p>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2">
        {memberNeedsApproval ? (
          <Button
            type="submit"
            name="action"
            value="approval"
            disabled={selected.size === 0}
          >
            Submit for approval
          </Button>
        ) : (
          <>
            {scheduled ? (
              <Button
                type="submit"
                name="action"
                value="schedule"
                disabled={selected.size === 0}
              >
                {canPublishDirectly ? "Schedule" : "Submit for approval"}
              </Button>
            ) : (
              <Button
                type="submit"
                name="action"
                value="publish"
                disabled={selected.size === 0}
              >
                {canPublishDirectly ? "Post now" : "Submit for approval"}
              </Button>
            )}
            <Button
              type="submit"
              name="action"
              value="draft"
              variant="outline"
              disabled={selected.size === 0}
            >
              Save as draft
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
