"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AVAILABLE_MERGE_FIELDS } from "@/lib/email/render-template";
import { createWorkbenchCampaign } from "../actions";

const PLATFORMS = [
  {
    value: "instagram",
    label: "Instagram",
    hint: "Copy → ig.me opens DM. You paste & send.",
  },
  {
    value: "tiktok",
    label: "TikTok",
    hint: "Copy → profile page opens. Click DM, paste & send.",
  },
  {
    value: "reddit",
    label: "Reddit",
    hint: "Compose page opens pre-filled. One click to send.",
  },
  {
    value: "youtube",
    label: "YouTube",
    hint: "No DMs. Opens channel page so you can find the contact email.",
  },
] as const;

export function NewCampaignForm({
  lists,
}: {
  lists: { id: string; name: string; memberCount: number }[];
}) {
  const [platform, setPlatform] = useState<
    "instagram" | "tiktok" | "reddit" | "youtube"
  >("instagram");
  const [body, setBody] = useState(
    "Hey {{first_name}}!\n\nI'd love to send you something. Let me know if you're interested.",
  );

  return (
    <form action={createWorkbenchCampaign} className="grid max-w-2xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Campaign name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="e.g. Film X – IG tier 1"
        />
      </div>

      <div className="grid gap-2">
        <Label>Platform</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLATFORMS.map((p) => (
            <label
              key={p.value}
              className={`cursor-pointer rounded-md border p-3 text-sm ${
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
            </label>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          {PLATFORMS.find((p) => p.value === platform)?.hint}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="listId">Contact list</Label>
        <select
          id="listId"
          name="listId"
          required
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.memberCount} contacts)
            </option>
          ))}
        </select>
      </div>

      {platform === "reddit" ? (
        <div className="grid gap-2">
          <Label htmlFor="subject">Reddit subject</Label>
          <Input
            id="subject"
            name="subject"
            placeholder="Quick note about Film X"
          />
        </div>
      ) : null}

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="body">Message</Label>
          <div className="flex flex-wrap gap-1">
            {AVAILABLE_MERGE_FIELDS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() =>
                  setBody((b) => b + `{{${f}}}`)
                }
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                + {`{{${f}}}`}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id="body"
          name="body"
          required
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white p-3 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
        <p className="text-xs text-zinc-500">
          Plain text. Keep it short — DMs convert better when they look human.
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit">Start workbench</Button>
      </div>
    </form>
  );
}
