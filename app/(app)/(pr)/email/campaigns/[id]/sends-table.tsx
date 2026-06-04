"use client";
import Link from "next/link";
import { ReplyToggle } from "@/components/reply-toggle";

type SendRow = {
  id: string;
  status: string | null;
  sentAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  repliedAt: Date | null;
  error: string | null;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
};

const STATUS_CHIP: Record<string, string> = {
  sent:      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  delivered: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  opened:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  clicked:   "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  replied:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  failed:    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  skipped:   "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  queued:    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  bounced:   "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const min = 60 * 1000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SendsTable({ rows }: { rows: SendRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Recipient</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">Opened</th>
            <th className="px-4 py-2.5 font-semibold">Clicked</th>
            <th className="px-4 py-2.5 font-semibold">Reply</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.id}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
            >
              <td className="px-4 py-2.5">
                <Link
                  href={`/contacts/${s.contactId}`}
                  className="font-medium hover:underline"
                >
                  {s.contactName}
                </Link>
                {s.contactEmail && (
                  <div className="text-xs text-zinc-400">{s.contactEmail}</div>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_CHIP[s.status ?? ""] ?? "bg-zinc-100 text-zinc-500"}`}
                >
                  {s.status ?? "—"}
                </span>
                {s.error && (
                  <div className="mt-0.5 text-[11px] text-red-500 truncate max-w-[180px]" title={s.error}>
                    {s.error}
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-zinc-500">{fmt(s.openedAt)}</td>
              <td className="px-4 py-2.5 text-xs text-zinc-500">{fmt(s.clickedAt)}</td>
              <td className="px-4 py-2.5">
                {s.status !== "skipped" && s.status !== "failed" ? (
                  <ReplyToggle sendId={s.id} initialReplied={s.repliedAt != null} />
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
