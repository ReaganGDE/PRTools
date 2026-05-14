import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/lib/db/schema";

export function ContactForm({
  action,
  initial,
  submitLabel = "Save",
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Partial<Contact>;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={initial?.name ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue={initial?.type ?? "influencer"}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="influencer">Influencer</option>
            <option value="outlet">Outlet</option>
            <option value="journalist">Journalist</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="primaryPlatform">Primary platform</Label>
          <select
            id="primaryPlatform"
            name="primaryPlatform"
            defaultValue={initial?.primaryPlatform ?? ""}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">—</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="reddit">Reddit</option>
            <option value="youtube">YouTube</option>
            <option value="email">Email only</option>
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={initial?.email ?? ""}
        />
      </div>
      <fieldset className="grid gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Handles
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="handleInstagram">Instagram</Label>
            <Input
              id="handleInstagram"
              name="handleInstagram"
              placeholder="username"
              defaultValue={initial?.handleInstagram ?? ""}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="handleTiktok">TikTok</Label>
            <Input
              id="handleTiktok"
              name="handleTiktok"
              placeholder="username"
              defaultValue={initial?.handleTiktok ?? ""}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="handleReddit">Reddit</Label>
            <Input
              id="handleReddit"
              name="handleReddit"
              placeholder="username (no u/)"
              defaultValue={initial?.handleReddit ?? ""}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="handleYoutube">YouTube</Label>
            <Input
              id="handleYoutube"
              name="handleYoutube"
              placeholder="@channel"
              defaultValue={initial?.handleYoutube ?? ""}
            />
          </div>
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="outlet">Outlet</Label>
          <Input
            id="outlet"
            name="outlet"
            placeholder="e.g. Vanity Fair"
            defaultValue={initial?.outlet ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="beat">Beat</Label>
          <Input
            id="beat"
            name="beat"
            placeholder="e.g. Film, Tech"
            defaultValue={initial?.beat ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="followerCount">Followers</Label>
          <Input
            id="followerCount"
            name="followerCount"
            type="number"
            defaultValue={initial?.followerCount ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            name="tags"
            placeholder="film-critic, tier-1"
            defaultValue={initial?.tags?.join(", ") ?? ""}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={initial?.notes ?? ""}
          className="rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
