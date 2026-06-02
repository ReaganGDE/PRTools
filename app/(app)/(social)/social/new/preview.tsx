"use client";
import { Heart, MessageCircle, Send, Bookmark, ArrowUp, ArrowDown, MoreHorizontal, ThumbsUp, Repeat2 } from "lucide-react";

type Platform =
  | "instagram"
  | "facebook"
  | "youtube"
  | "reddit"
  | "tiktok"
  | "x"
  | "linkedin"
  | "pinterest"
  | "threads"
  | "bluesky"
  | "snapchat"
  | "gbp";

function normalizeType(t: string): Platform {
  const k = t.toLowerCase();
  if (k.includes("instagram")) return "instagram";
  if (k.includes("facebook")) return "facebook";
  if (k.includes("youtube")) return "youtube";
  if (k.includes("reddit")) return "reddit";
  if (k.includes("tiktok")) return "tiktok";
  if (k === "x" || k.includes("twitter")) return "x";
  if (k.includes("linkedin")) return "linkedin";
  if (k.includes("pinterest")) return "pinterest";
  if (k.includes("threads")) return "threads";
  if (k.includes("bluesky")) return "bluesky";
  if (k.includes("snapchat")) return "snapchat";
  return "gbp";
}

export function PostPreview({
  selectedTypes,
  title,
  body,
  subreddit,
  mediaUrls,
  mediaKind,
}: {
  selectedTypes: string[];
  title: string;
  body: string;
  subreddit: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  const uniquePlatforms = Array.from(
    new Set(selectedTypes.map(normalizeType)),
  );

  if (uniquePlatforms.length === 0) {
    return (
      <div className="sticky top-24 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/20">
        <p className="text-sm text-zinc-500">
          Select accounts to see a live preview
        </p>
      </div>
    );
  }

  return (
    <div className="sticky top-24 space-y-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Live preview
      </div>
      {uniquePlatforms.map((p) => (
        <PlatformPreview
          key={p}
          platform={p}
          title={title}
          body={body}
          subreddit={subreddit}
          mediaUrls={mediaUrls}
          mediaKind={mediaKind}
        />
      ))}
    </div>
  );
}

function MediaSlot({
  mediaUrls,
  mediaKind,
  aspect = "square",
}: {
  mediaUrls: string[];
  mediaKind: "image" | "video";
  aspect?: "square" | "video" | "tall";
}) {
  const aspectCls =
    aspect === "tall"
      ? "aspect-[9/16]"
      : aspect === "video"
        ? "aspect-video"
        : "aspect-square";
  if (mediaUrls.length === 0) {
    return (
      <div
        className={`${aspectCls} flex items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800`}
      >
        media will appear here
      </div>
    );
  }
  const first = mediaUrls[0];
  if (mediaKind === "video") {
    return (
      <video
        src={first}
        className={`${aspectCls} w-full bg-black object-cover`}
        controls
        muted
        playsInline
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={first}
      alt=""
      className={`${aspectCls} w-full object-cover`}
    />
  );
}

function PlatformPreview(props: {
  platform: Platform;
  title: string;
  body: string;
  subreddit: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  switch (props.platform) {
    case "instagram":
      return <InstagramPreview {...props} />;
    case "facebook":
      return <FacebookPreview {...props} />;
    case "x":
      return <TwitterPreview {...props} />;
    case "linkedin":
      return <LinkedInPreview {...props} />;
    case "reddit":
      return <RedditPreview {...props} />;
    case "youtube":
      return <YouTubePreview {...props} />;
    case "tiktok":
      return <TikTokPreview {...props} />;
    case "threads":
      return <ThreadsPreview {...props} />;
    default:
      return <GenericPreview {...props} />;
  }
}

function PreviewFrame({
  network,
  children,
}: {
  network: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <span>{network}</span>
      </div>
      {children}
    </div>
  );
}

function Avatar({ label = "G" }: { label?: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-xs font-semibold text-white">
      {label}
    </div>
  );
}

function InstagramPreview({
  body,
  mediaUrls,
  mediaKind,
}: {
  body: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  return (
    <PreviewFrame network="Instagram">
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar />
        <span className="text-sm font-semibold">your_handle</span>
        <MoreHorizontal className="ml-auto h-4 w-4 text-zinc-500" />
      </div>
      <MediaSlot mediaUrls={mediaUrls} mediaKind={mediaKind} />
      <div className="flex items-center gap-3 px-3 pb-1 pt-2 text-zinc-700 dark:text-zinc-300">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <Send className="h-5 w-5" />
        <Bookmark className="ml-auto h-5 w-5" />
      </div>
      <div className="px-3 pb-3 text-xs">
        <span className="font-semibold">your_handle</span>{" "}
        <span className="text-zinc-700 dark:text-zinc-300">
          {body || <span className="text-zinc-400">caption…</span>}
        </span>
      </div>
    </PreviewFrame>
  );
}

function FacebookPreview({
  body,
  mediaUrls,
  mediaKind,
}: {
  body: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  return (
    <PreviewFrame network="Facebook">
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar />
        <div className="text-xs">
          <div className="font-semibold">Your Page</div>
          <div className="text-zinc-500">Just now · 🌎</div>
        </div>
      </div>
      <div className="whitespace-pre-wrap px-3 pb-2 text-sm">
        {body || <span className="text-zinc-400">post text…</span>}
      </div>
      <MediaSlot mediaUrls={mediaUrls} mediaKind={mediaKind} aspect="video" />
      <div className="flex items-center gap-4 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5" /> Like
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" /> Comment
        </span>
        <span className="flex items-center gap-1">
          <Send className="h-3.5 w-3.5" /> Share
        </span>
      </div>
    </PreviewFrame>
  );
}

function TwitterPreview({
  body,
  mediaUrls,
  mediaKind,
}: {
  body: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  const limit = 280;
  const over = body.length > limit;
  return (
    <PreviewFrame network="X (Twitter)">
      <div className="flex gap-3 p-3">
        <Avatar />
        <div className="min-w-0 flex-1">
          <div className="text-xs">
            <span className="font-semibold">Your Handle</span>{" "}
            <span className="text-zinc-500">@your_handle · now</span>
          </div>
          <div
            className={`mt-1 whitespace-pre-wrap text-sm ${over ? "text-red-600" : ""}`}
          >
            {body || <span className="text-zinc-400">what&apos;s happening?</span>}
          </div>
          {mediaUrls.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <MediaSlot
                mediaUrls={mediaUrls}
                mediaKind={mediaKind}
                aspect="video"
              />
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-5 text-[11px] text-zinc-500">
            <MessageCircle className="h-3.5 w-3.5" />
            <Repeat2 className="h-3.5 w-3.5" />
            <Heart className="h-3.5 w-3.5" />
            {over ? (
              <span className="text-red-600">
                {body.length}/{limit}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

function LinkedInPreview({
  body,
  mediaUrls,
  mediaKind,
}: {
  body: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  return (
    <PreviewFrame network="LinkedIn">
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar />
        <div className="text-xs">
          <div className="font-semibold">Your Company</div>
          <div className="text-zinc-500">Just now · 🌐</div>
        </div>
      </div>
      <div className="whitespace-pre-wrap px-3 pb-2 text-sm">
        {body || <span className="text-zinc-400">share an update…</span>}
      </div>
      <MediaSlot mediaUrls={mediaUrls} mediaKind={mediaKind} aspect="video" />
      <div className="flex items-center gap-4 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
        <ThumbsUp className="h-3.5 w-3.5" />
        <MessageCircle className="h-3.5 w-3.5" />
        <Repeat2 className="h-3.5 w-3.5" />
      </div>
    </PreviewFrame>
  );
}

function RedditPreview({
  title,
  body,
  subreddit,
  mediaUrls,
  mediaKind,
}: {
  title: string;
  body: string;
  subreddit: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  const sub = subreddit
    ? subreddit.startsWith("u_")
      ? `u/${subreddit.slice(2)}`
      : `r/${subreddit}`
    : "r/subreddit";
  return (
    <PreviewFrame network="Reddit">
      <div className="flex gap-2 p-3">
        <div className="flex flex-col items-center gap-0.5 text-zinc-500">
          <ArrowUp className="h-4 w-4" />
          <span className="text-[11px] font-semibold">1</span>
          <ArrowDown className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-zinc-500">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {sub}
            </span>
            <span> · posted by u/you · now</span>
          </div>
          <div className="mt-1 text-base font-semibold leading-tight">
            {title || <span className="text-zinc-400">post title…</span>}
          </div>
          {mediaUrls.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-md">
              <MediaSlot
                mediaUrls={mediaUrls}
                mediaKind={mediaKind}
                aspect="video"
              />
            </div>
          ) : null}
          {body ? (
            <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
              {body}
            </p>
          ) : null}
        </div>
      </div>
    </PreviewFrame>
  );
}

function YouTubePreview({
  title,
  body,
  mediaUrls,
  mediaKind,
}: {
  title: string;
  body: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  return (
    <PreviewFrame network="YouTube">
      <MediaSlot mediaUrls={mediaUrls} mediaKind={mediaKind} aspect="video" />
      <div className="flex gap-2 p-3">
        <Avatar />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-tight">
            {title || <span className="text-zinc-400">video title…</span>}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Your Channel · 0 views · now
          </div>
          {body ? (
            <p className="mt-1.5 line-clamp-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              {body}
            </p>
          ) : null}
        </div>
      </div>
    </PreviewFrame>
  );
}

function TikTokPreview({
  body,
  mediaUrls,
  mediaKind,
}: {
  body: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  return (
    <PreviewFrame network="TikTok">
      <div className="relative bg-black">
        <MediaSlot mediaUrls={mediaUrls} mediaKind={mediaKind} aspect="tall" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
          <div className="text-xs font-semibold">@your_handle</div>
          <div className="mt-1 line-clamp-2 text-xs">
            {body || <span className="text-zinc-400">caption…</span>}
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

function ThreadsPreview({
  body,
  mediaUrls,
  mediaKind,
}: {
  body: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  return (
    <PreviewFrame network="Threads">
      <div className="flex gap-3 p-3">
        <Avatar />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">your_handle</div>
          <div className="mt-1 whitespace-pre-wrap text-sm">
            {body || <span className="text-zinc-400">start a thread…</span>}
          </div>
          {mediaUrls.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <MediaSlot
                mediaUrls={mediaUrls}
                mediaKind={mediaKind}
                aspect="video"
              />
            </div>
          ) : null}
        </div>
      </div>
    </PreviewFrame>
  );
}

function GenericPreview({
  platform,
  body,
  mediaUrls,
  mediaKind,
}: {
  platform: Platform;
  body: string;
  mediaUrls: string[];
  mediaKind: "image" | "video";
}) {
  return (
    <PreviewFrame network={platform}>
      <MediaSlot mediaUrls={mediaUrls} mediaKind={mediaKind} aspect="video" />
      <div className="p-3 text-sm">
        {body || <span className="text-zinc-400">post text…</span>}
      </div>
    </PreviewFrame>
  );
}
