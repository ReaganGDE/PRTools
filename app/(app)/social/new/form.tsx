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

export function NewPostForm() {
  const [platform, setPlatform] = useState<
    "reddit" | "youtube" | "facebook" | "instagram"
  >("reddit");
  const [scheduled, setScheduled] = useState(false);

  return (
    <form action={createPost} className="grid max-w-2xl gap-4">
      <div className="grid gap-2">
        <Label>Platform</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLATFORMS.map((p) => (
            <label
              key={p.value}
              className={`relative cursor-pointer rounded-md border p-3 text-sm ${
                platform === p.value
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              }`}
            >
              <input
                type="radio"
                name="platform"
                value={p.value}
                checked={platform === p.value}
                onChange={() => setPlatform(p.value)}
                className="sr-only"
                required
              />
              <div className="font-medium">{p.label}</div>
              {!p.working ? (
                <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Coming
                </div>
              ) : null}
            </label>
          ))}
        </div>
      </div>

      {platform === "reddit" ? (
        <>
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
        </>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="body">Body</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={8}
          className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          placeholder={
            platform === "reddit"
              ? "Markdown supported. Skip if you provided a link URL above."
              : "What do you want to say?"
          }
        />
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

      <div className="flex gap-2">
        {scheduled ? (
          <Button type="submit" name="action" value="schedule">
            Schedule
          </Button>
        ) : (
          <>
            <Button type="submit" name="action" value="publish">
              Post now
            </Button>
            <Button type="submit" name="action" value="draft" variant="outline">
              Save as draft
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
