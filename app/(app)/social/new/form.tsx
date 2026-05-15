"use client";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPost,
  getOneUpUploadUrl,
  listOneUpCategories,
  listOneUpCategoryAccounts,
} from "../actions";

type Category = { id: number; category_name: string };
type Account = {
  social_network_id: string;
  social_network_name: string;
  social_network_type: string;
};

function needsTitle(types: string[]): boolean {
  return types.some((t) => {
    const k = t.toLowerCase();
    return k.includes("reddit") || k.includes("youtube") || k.includes("threads");
  });
}

function hasReddit(types: string[]): boolean {
  return types.some((t) => t.toLowerCase().includes("reddit"));
}

export function NewPostForm() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [scheduled, setScheduled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    listOneUpCategories()
      .then((d) => setCategories(d as Category[]))
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!categoryId) return;
    listOneUpCategoryAccounts(categoryId)
      .then((d) => {
        setAccounts(d as Account[]);
        setSelectedIds([]);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [categoryId]);

  const selectedAccounts = accounts.filter((a) =>
    selectedIds.includes(a.social_network_id),
  );
  const selectedTypes = selectedAccounts.map((a) => a.social_network_type);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const { upload_url, file_path } = await getOneUpUploadUrl();
      const put = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
      startTransition(() => {
        setMediaUrls((cur) => [...cur, file_path]);
      });
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={createPost} className="grid max-w-2xl gap-4">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input
        type="hidden"
        name="accounts"
        value={JSON.stringify(
          selectedAccounts.map((a) => ({
            id: a.social_network_id,
            name: a.social_network_name,
            type: a.social_network_type,
          })),
        )}
      />
      <input type="hidden" name="mediaKind" value={mediaKind} />
      <input
        type="hidden"
        name="mediaUrls"
        value={JSON.stringify(mediaUrls)}
      />
      <input type="hidden" name="thumbnailUrl" value={thumbnailUrl} />

      {loadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          OneUp error: {loadError}. Check <code>ONEUP_API_KEY</code> in Vercel.
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">
            {categories ? "Pick a category…" : "Loading…"}
          </option>
          {categories?.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.category_name}
            </option>
          ))}
        </select>
      </div>

      {accounts.length > 0 ? (
        <div className="grid gap-2">
          <Label>Post to</Label>
          <div className="grid gap-1 rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
            {accounts.map((a) => {
              const checked = selectedIds.includes(a.social_network_id);
              return (
                <label
                  key={a.social_network_id}
                  className="flex cursor-pointer items-center gap-2 rounded-sm p-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setSelectedIds((cur) =>
                        e.target.checked
                          ? [...cur, a.social_network_id]
                          : cur.filter((x) => x !== a.social_network_id),
                      );
                    }}
                  />
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    {a.social_network_type}
                  </span>
                  <span className="truncate">{a.social_network_name}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label>Media type</Label>
        <div className="flex gap-2">
          {(["image", "video"] as const).map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm capitalize ${
                mediaKind === k
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <input
                type="radio"
                checked={mediaKind === k}
                onChange={() => {
                  setMediaKind(k);
                  setMediaUrls([]);
                }}
                className="sr-only"
              />
              {k}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>{mediaKind === "video" ? "Video file" : "Image file(s)"}</Label>
        <input
          type="file"
          accept={mediaKind === "video" ? "video/*" : "image/*"}
          multiple={mediaKind === "image"}
          disabled={uploading}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            for (const f of files) handleFile(f);
            e.target.value = "";
          }}
          className="text-sm"
        />
        {uploading ? (
          <p className="text-xs text-zinc-500">Uploading…</p>
        ) : null}
        {uploadError ? (
          <p className="text-xs text-red-600">{uploadError}</p>
        ) : null}
        {mediaUrls.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {mediaUrls.map((u, i) => (
              <li key={u} className="flex items-center justify-between gap-2">
                <span className="truncate text-zinc-600 dark:text-zinc-400">
                  {u}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setMediaUrls((cur) => cur.filter((_, j) => j !== i))
                  }
                  className="text-red-600 hover:underline"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-zinc-500">
          Or paste a public URL:{" "}
          <input
            type="url"
            placeholder="https://…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = (e.target as HTMLInputElement).value.trim();
                if (v) {
                  setMediaUrls((cur) => [...cur, v]);
                  (e.target as HTMLInputElement).value = "";
                }
              }
            }}
            className="ml-1 w-72 rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-950"
          />
        </p>
      </div>

      {mediaKind === "video" ? (
        <div className="grid gap-2">
          <Label htmlFor="thumbnailUrl">Thumbnail URL (optional)</Label>
          <Input
            id="thumbnailUrl"
            type="url"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
      ) : null}

      {needsTitle(selectedTypes) ? (
        <div className="grid gap-2">
          <Label htmlFor="title">Title (Reddit / YouTube / Threads)</Label>
          <Input id="title" name="title" maxLength={300} />
        </div>
      ) : null}

      {hasReddit(selectedTypes) ? (
        <div className="grid gap-2">
          <Label htmlFor="subreddit">Subreddit (without r/)</Label>
          <Input
            id="subreddit"
            name="subreddit"
            placeholder="e.g. movies — or u_yourusername for your profile"
          />
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="body">Caption</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={6}
          className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
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
          <Button
            type="submit"
            name="action"
            value="schedule"
            disabled={
              uploading ||
              mediaUrls.length === 0 ||
              selectedIds.length === 0 ||
              !categoryId
            }
          >
            Schedule
          </Button>
        ) : (
          <>
            <Button
              type="submit"
              name="action"
              value="publish"
              disabled={
                uploading ||
                mediaUrls.length === 0 ||
                selectedIds.length === 0 ||
                !categoryId
              }
            >
              Post now
            </Button>
            <Button
              type="submit"
              name="action"
              value="draft"
              variant="outline"
              disabled={uploading || !categoryId}
            >
              Save as draft
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
