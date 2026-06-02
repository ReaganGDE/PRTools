"use client";
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createPost,
  listOneUpCategories,
  listOneUpCategoryAccounts,
} from "../actions";
import { PostPreview } from "./preview";

type Category = { id: number; category_name: string };
type Account = {
  social_network_id: string;
  social_network_name: string;
  social_network_type: string;
};

const CHAR_LIMITS: Record<string, number> = {
  x: 280,
  twitter: 280,
  threads: 500,
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  reddit: 40000,
  youtube: 5000,
  bluesky: 300,
};

function getCharLimit(types: string[]): number | null {
  const limits = types.map((t) => {
    const k = t.toLowerCase();
    for (const [key, val] of Object.entries(CHAR_LIMITS)) {
      if (k.includes(key)) return val;
    }
    return null;
  }).filter((v): v is number => v !== null);
  return limits.length > 0 ? Math.min(...limits) : null;
}

function needsTitle(types: string[]): boolean {
  return types.some((t) => {
    const k = t.toLowerCase();
    return k.includes("reddit") || k.includes("youtube") || k.includes("threads");
  });
}

function hasReddit(types: string[]): boolean {
  return types.some((t) => t.toLowerCase().includes("reddit"));
}

type ScheduleMode = "publish" | "schedule" | "draft";

type BrandOpt = { id: string; name: string; color: string };
type MovieOpt = { id: string; title: string; brandId: string | null };

export function NewPostForm({
  brands,
  movies,
  defaultBrandId,
}: {
  brands: BrandOpt[];
  movies: MovieOpt[];
  defaultBrandId: string | null;
}) {
  const [brandId, setBrandId] = useState<string>(defaultBrandId ?? "");
  const [movieId, setMovieId] = useState<string>("");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [mediaFiles, setMediaFiles] = useState<{ url: string; name: string; isBlob: boolean }[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [mode, setMode] = useState<ScheduleMode>("publish");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isPending, startTransition] = useTransition();

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
  const mediaUrls = mediaFiles.map((f) => f.url);
  const charLimit = getCharLimit(selectedTypes);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: file.type,
      });
      setMediaFiles((cur) => [...cur, { url: blob.url, name: file.name, isBlob: true }]);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || isPending;

  function localNow(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("clientNow", localNow());
    fd.set("mediaUrls", JSON.stringify(mediaUrls));
    fd.set("accounts", JSON.stringify(
      selectedAccounts.map((a) => ({
        id: a.social_network_id,
        name: a.social_network_name,
        type: a.social_network_type,
      })),
    ));
    startTransition(async () => {
      await createPost(fd);
    });
  }

  const canSubmit = mediaUrls.length > 0 && selectedIds.length > 0 && !!categoryId;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="mediaKind" value={mediaKind} />
        <input type="hidden" name="thumbnailUrl" value={thumbnailUrl} />
        <input type="hidden" name="action" value={mode} />
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="movieId" value={movieId} />

        {loadError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            OneUp error: {loadError}. Check <code>ONEUP_API_KEY</code> in Vercel.
          </div>
        ) : null}

        {/* BRAND */}
        {brands.length > 0 && (
          <Section title="Brand & Campaign">
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBrandId(b.id);
                      // clear movie if it doesn't belong to this brand
                      const m = movies.find((x) => x.id === movieId);
                      if (m && m.brandId !== b.id) setMovieId("");
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      brandId === b.id
                        ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900",
                    )}
                  >
                    <span
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: b.color }}
                    />
                    {b.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setBrandId("");
                    setMovieId("");
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    !brandId
                      ? "border-zinc-400 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900",
                  )}
                >
                  No brand
                </button>
              </div>

              {movies.length > 0 && (
                <div className="grid gap-1.5">
                  <Label htmlFor="movieId">Movie campaign (optional)</Label>
                  <select
                    id="movieId"
                    value={movieId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setMovieId(next);
                      const m = movies.find((x) => x.id === next);
                      if (m?.brandId) setBrandId(m.brandId);
                    }}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm transition-all focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">— None —</option>
                    {movies
                      .filter((m) => !brandId || m.brandId === brandId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* WHERE */}
        <Section title="Where">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm transition-all focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900"
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
              <div className="grid gap-1.5">
                <Label>Accounts</Label>
                <div className="grid gap-0.5 rounded-md border border-zinc-200 p-1.5 dark:border-zinc-800">
                  {accounts.map((a) => {
                    const checked = selectedIds.includes(a.social_network_id);
                    return (
                      <label
                        key={a.social_network_id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                          checked
                            ? "bg-red-50 dark:bg-red-950/20"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                        )}
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
                          className="accent-red-600"
                        />
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium dark:bg-zinc-800">
                          {a.social_network_type}
                        </span>
                        <span className="truncate">{a.social_network_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </Section>

        {/* MEDIA */}
        <Section title="Media">
          <div className="grid gap-3">
            <div className="flex gap-2">
              {(["image", "video"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setMediaKind(k);
                    setMediaFiles([]);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    mediaKind === k
                      ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Image thumbnails */}
            {mediaFiles.length > 0 && mediaKind === "image" && (
              <div className="grid grid-cols-3 gap-2">
                {mediaFiles.map((f, i) => (
                  <div key={f.url} className="group/thumb relative aspect-square overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                    <Image src={f.url} alt={f.name} fill className="object-cover" unoptimized />
                    <button
                      type="button"
                      onClick={() => setMediaFiles((cur) => cur.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 opacity-0 transition-opacity group-hover/thumb:opacity-100"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {mediaFiles.length > 0 && mediaKind === "video" && (
              <ul className="grid gap-1.5">
                {mediaFiles.map((f, i) => (
                  <li
                    key={f.url}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <span className="truncate text-zinc-600 dark:text-zinc-400">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setMediaFiles((cur) => cur.filter((_, j) => j !== i))}
                      className="ml-auto rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const files = Array.from(e.dataTransfer.files);
                for (const f of files) handleFile(f);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-6 text-center transition-colors",
                dragActive
                  ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
                  : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600",
                uploading ? "pointer-events-none opacity-60" : "",
              )}
            >
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
                className="hidden"
              />
              <Upload className="h-5 w-5 text-zinc-400" />
              <div className="text-sm">
                <span className="font-medium text-red-600 dark:text-red-400">
                  {uploading ? "Uploading…" : "Click to upload"}
                </span>
                {!uploading && <span className="text-zinc-500"> or drag and drop</span>}
              </div>
              <div className="text-xs text-zinc-500">
                {mediaKind === "video" ? "MP4, MOV up to 1GB" : "PNG, JPG, GIF up to 1GB"}
              </div>
            </label>

            {uploadError ? (
              <p className="text-xs text-red-600">{uploadError}</p>
            ) : null}

            <details className="text-xs text-zinc-500">
              <summary className="cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-300">
                Or paste a public URL
              </summary>
              <input
                type="url"
                placeholder="https://…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) {
                      setMediaFiles((cur) => [...cur, { url: v, name: v.split("/").pop() ?? v, isBlob: false }]);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
                className="mt-2 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
              />
            </details>

            {mediaKind === "video" ? (
              <div className="grid gap-1.5">
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
          </div>
        </Section>

        {/* CONTENT */}
        <Section title="Content">
          <div className="grid gap-3">
            {needsTitle(selectedTypes) ? (
              <div className="grid gap-1.5">
                <Label htmlFor="title">
                  Title{" "}
                  <span className="text-zinc-500">(Reddit / YouTube / Threads)</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={300}
                />
              </div>
            ) : null}

            {hasReddit(selectedTypes) ? (
              <div className="grid gap-1.5">
                <Label htmlFor="subreddit">Subreddit</Label>
                <Input
                  id="subreddit"
                  name="subreddit"
                  value={subreddit}
                  onChange={(e) => setSubreddit(e.target.value)}
                  placeholder="e.g. movies — or u_yourusername for your profile"
                />
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="body">Caption</Label>
                {charLimit !== null && (
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      body.length > charLimit
                        ? "text-red-600 dark:text-red-400"
                        : body.length > charLimit * 0.9
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-400",
                    )}
                  >
                    {body.length} / {charLimit}
                  </span>
                )}
              </div>
              <textarea
                id="body"
                name="body"
                required
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm transition-all focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="What do you want to say?"
              />
            </div>
          </div>
        </Section>

        {/* SCHEDULE MODE */}
        <Section title="Publish">
          <div className="grid gap-3">
            <div className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
              {(
                [
                  { value: "publish", label: "Post now" },
                  { value: "schedule", label: "Schedule" },
                  { value: "draft", label: "Save draft" },
                ] as { value: ScheduleMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                    mode === opt.value
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {mode === "schedule" ? (
              <Input
                type="datetime-local"
                name="scheduledAt"
                required
                min={new Date().toISOString().slice(0, 16)}
              />
            ) : null}

            {mode === "publish" && (
              <p className="text-xs text-zinc-500">
                Posts immediately to all selected accounts via OneUp.
              </p>
            )}
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={busy || (mode !== "draft" && !canSubmit)}
          >
            {isPending
              ? mode === "publish"
                ? "Posting…"
                : mode === "schedule"
                  ? "Scheduling…"
                  : "Saving…"
              : mode === "publish"
                ? "Post now"
                : mode === "schedule"
                  ? "Schedule post"
                  : "Save draft"}
          </Button>
          {!canSubmit && mode !== "draft" && (
            <span className="text-xs text-zinc-400">
              {!categoryId
                ? "Pick a category first"
                : selectedIds.length === 0
                  ? "Select at least one account"
                  : "Add media to continue"}
            </span>
          )}
          {isPending ? (
            <span className="text-xs text-zinc-500">Sending to OneUp, please wait…</span>
          ) : null}
        </div>
      </form>

      <aside className="hidden lg:block">
        <div className="sticky top-8">
          <PostPreview
            selectedTypes={selectedTypes}
            title={title}
            body={body}
            subreddit={subreddit}
            mediaUrls={mediaUrls}
            mediaKind={mediaKind}
          />
        </div>
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
      <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {title}
      </div>
      {children}
    </div>
  );
}
