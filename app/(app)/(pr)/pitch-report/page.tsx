import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-helpers";
import { requireSectionAccess } from "@/lib/tool-access";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Mail,
  MailOpen,
  MessageSquareReply,
  TrendingUp,
  Send,
  ExternalLink,
} from "lucide-react";
import { ReplyToggle } from "@/components/reply-toggle";

type SubjectRow = {
  subject: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
};

type OpenNoReplyRow = {
  sendId: string;
  contactId: string;
  name: string;
  email: string | null;
  outlet: string | null;
  movieId: string | null;
  title: string | null;
  subject: string | null;
  openedAt: string;
};

function pct(n: number, d: number): number {
  if (d === 0) return 0;
  return Math.round((n / d) * 100);
}

function RateBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="tabular-nums text-xs text-zinc-500">{value}%</span>
    </div>
  );
}

export default async function PitchReportPage() {
  await requireSectionAccess("pr");
  const session = await requireSession();
  const wsId = session.workspaceId;

  // Subject-line A/B performance across all pitch campaigns (campaigns linked
  // to a film). Excludes skipped/failed sends from the denominator.
  const subjectRows = (await db.execute(sql`
    SELECT s.rendered_subject AS subject,
           count(*)::int AS sent,
           count(s.opened_at)::int AS opened,
           count(s.clicked_at)::int AS clicked,
           count(s.replied_at)::int AS replied
    FROM sends s
    JOIN campaigns ca ON ca.id = s.campaign_id
    WHERE s.workspace_id = ${wsId}
      AND s.channel = 'email'
      AND ca.movie_id IS NOT NULL
      AND s.rendered_subject IS NOT NULL
      AND s.status NOT IN ('skipped', 'failed')
    GROUP BY s.rendered_subject
    ORDER BY count(*) DESC, count(s.opened_at) DESC
    LIMIT 50
  `)) as unknown as SubjectRow[];

  const totals = subjectRows.reduce(
    (acc, r) => ({
      sent: acc.sent + r.sent,
      opened: acc.opened + r.opened,
      clicked: acc.clicked + r.clicked,
      replied: acc.replied + r.replied,
    }),
    { sent: 0, opened: 0, clicked: 0, replied: 0 },
  );

  // Sort by open rate for the ranked view (require a minimum sample of 2).
  const ranked = [...subjectRows].sort(
    (a, b) => pct(b.opened, b.sent) - pct(a.opened, a.sent),
  );

  // High-intent: opened a pitch but never replied.
  const openNoReply = (await db.execute(sql`
    SELECT s.id AS "sendId",
           c.id AS "contactId", c.name, c.email, c.outlet,
           ca.movie_id AS "movieId", m.title,
           s.rendered_subject AS subject,
           s.opened_at AS "openedAt"
    FROM sends s
    JOIN contacts c ON c.id = s.contact_id
    JOIN campaigns ca ON ca.id = s.campaign_id
    LEFT JOIN movies m ON m.id = ca.movie_id
    WHERE s.workspace_id = ${wsId}
      AND s.channel = 'email'
      AND s.opened_at IS NOT NULL
      AND s.replied_at IS NULL
      AND ca.movie_id IS NOT NULL
    ORDER BY s.opened_at DESC
    LIMIT 50
  `)) as unknown as OpenNoReplyRow[];

  const hasData = subjectRows.length > 0;

  return (
    <>
      <PageHeader
        title="Pitch report"
        description="How your pitch emails are performing — by subject line and follow-up opportunities."
      />
      <div className="mx-auto max-w-5xl space-y-8 p-8">
        {!hasData ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <Send className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              No pitch emails sent yet. Pitch a film to a contact and results
              will show here.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/movies">Go to films</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Headline stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon={<Mail className="h-4 w-4" />} label="Pitches sent" value={totals.sent} />
              <StatCard
                icon={<MailOpen className="h-4 w-4" />}
                label="Open rate"
                value={`${pct(totals.opened, totals.sent)}%`}
                sub={`${totals.opened} opened`}
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Click rate"
                value={`${pct(totals.clicked, totals.sent)}%`}
                sub={`${totals.clicked} clicked`}
              />
              <StatCard
                icon={<MessageSquareReply className="h-4 w-4" />}
                label="Reply rate"
                value={`${pct(totals.replied, totals.sent)}%`}
                sub={`${totals.replied} replied`}
              />
            </div>

            {/* Subject-line A/B */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subject lines, ranked by open rate</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-y border-zinc-100 bg-zinc-50/50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Subject</th>
                        <th className="px-4 py-2.5 font-semibold">Sent</th>
                        <th className="px-4 py-2.5 font-semibold">Open rate</th>
                        <th className="px-4 py-2.5 font-semibold">Reply rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((r, i) => (
                        <tr
                          key={`${r.subject}-${i}`}
                          className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/40"
                        >
                          <td className="max-w-md px-4 py-3">
                            <span className="line-clamp-1 font-medium">{r.subject}</span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-zinc-500">{r.sent}</td>
                          <td className="px-4 py-3">
                            <RateBar value={pct(r.opened, r.sent)} color="bg-emerald-500" />
                          </td>
                          <td className="px-4 py-3">
                            <RateBar value={pct(r.replied, r.sent)} color="bg-blue-500" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Opened but didn't reply */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                  Opened, awaiting reply
                </h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {openNoReply.length}
                </span>
              </div>
              <p className="mb-3 text-xs text-zinc-500">
                These contacts opened your pitch but haven&apos;t replied — high-intent targets for a nudge.
              </p>
              {openNoReply.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
                  Nobody fits this yet. Once recipients open a pitch, they&apos;ll appear here.
                </p>
              ) : (
                <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-900">
                  {openNoReply.map((r) => (
                    <div key={r.sendId} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/contacts/${r.contactId}`} className="font-medium hover:underline">
                            {r.name}
                          </Link>
                          {r.outlet && <span className="text-xs text-zinc-500">{r.outlet}</span>}
                          {r.title && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {r.title}
                            </span>
                          )}
                        </div>
                        {r.subject && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{r.subject}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-zinc-400">
                        opened {new Date(r.openedAt).toLocaleDateString()}
                      </span>
                      <ReplyToggle sendId={r.sendId} initialReplied={false} />
                      {r.movieId && (
                        <Link
                          href={`/movies/${r.movieId}/pitch`}
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          Pitch again <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}
