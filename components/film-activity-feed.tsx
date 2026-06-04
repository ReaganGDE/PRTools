import Link from "next/link";
import {
  Send,
  MailOpen,
  MousePointerClick,
  MessageSquareReply,
  Newspaper,
  Clapperboard,
} from "lucide-react";

export type ActivityEvent = {
  kind: "sent" | "opened" | "clicked" | "replied" | "coverage" | "screener";
  ts: string;
  contactName: string | null;
  contactId: string | null;
  detail: string | null;
};

const META: Record<
  ActivityEvent["kind"],
  { icon: typeof Send; tint: string; verb: string }
> = {
  sent:     { icon: Send,                tint: "text-blue-500",    verb: "was pitched" },
  opened:   { icon: MailOpen,            tint: "text-emerald-500", verb: "opened the pitch" },
  clicked:  { icon: MousePointerClick,   tint: "text-violet-500",  verb: "clicked a link" },
  replied:  { icon: MessageSquareReply,  tint: "text-emerald-600", verb: "replied" },
  coverage: { icon: Newspaper,           tint: "text-amber-500",   verb: "coverage logged" },
  screener: { icon: Clapperboard,        tint: "text-sky-500",     verb: "screener sent" },
};

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = 60_000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function FilmActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No outreach activity yet. Pitches, opens, replies, coverage, and screener
        sends will stream in here.
      </p>
    );
  }

  return (
    <ol className="relative space-y-3 pl-1">
      {events.map((e, i) => {
        const meta = META[e.kind];
        const Icon = meta.icon;
        return (
          <li key={i} className="flex items-start gap-3">
            <span className={`mt-0.5 shrink-0 ${meta.tint}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <span>
                {e.contactId ? (
                  <Link href={`/contacts/${e.contactId}`} className="font-medium hover:underline">
                    {e.contactName ?? "Someone"}
                  </Link>
                ) : (
                  <span className="font-medium">{e.contactName ?? "—"}</span>
                )}{" "}
                <span className="text-zinc-500">{meta.verb}</span>
                {e.detail && (
                  <span className="text-zinc-500">: &ldquo;{e.detail}&rdquo;</span>
                )}
              </span>
            </div>
            <time className="shrink-0 text-xs text-zinc-400">{rel(e.ts)}</time>
          </li>
        );
      })}
    </ol>
  );
}
