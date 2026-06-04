import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-helpers";
import { requireSectionAccess } from "@/lib/tool-access";
import { PageHeader } from "@/components/page-header";
import { Workflow } from "lucide-react";
import { SEQUENCE_STEPS, computeSequenceState } from "@/lib/sequences";
import { SequenceBoard, type SequenceRow } from "./sequence-board";

type Raw = {
  movieId: string;
  contactId: string;
  title: string | null;
  name: string;
  outlet: string | null;
  email: string | null;
  sentCount: number;
  lastSentAt: string | null;
  replied: boolean;
};

export default async function SequencesPage() {
  await requireSectionAccess("pr");
  const session = await requireSession();
  const wsId = session.workspaceId;

  // For every film↔contact link, aggregate the pitch emails sent for that film
  // and whether any was replied to. Step state is derived from these counts.
  const raw = (await db.execute(sql`
    SELECT mc.movie_id AS "movieId",
           mc.contact_id AS "contactId",
           m.title,
           c.name, c.outlet, c.email,
           count(s.id) FILTER (WHERE s.channel = 'email')::int AS "sentCount",
           max(s.sent_at) AS "lastSentAt",
           bool_or(s.replied_at IS NOT NULL) AS replied
    FROM movie_contacts mc
    JOIN movies m ON m.id = mc.movie_id
    JOIN contacts c ON c.id = mc.contact_id
    LEFT JOIN campaigns ca
      ON ca.movie_id = mc.movie_id AND ca.workspace_id = mc.workspace_id
    LEFT JOIN sends s
      ON s.campaign_id = ca.id AND s.contact_id = mc.contact_id
    WHERE mc.workspace_id = ${wsId}
    GROUP BY mc.movie_id, mc.contact_id, m.title, c.name, c.outlet, c.email
  `)) as unknown as Raw[];

  const rows: SequenceRow[] = [];
  for (const r of raw) {
    const lastSentAt = r.lastSentAt ? new Date(r.lastSentAt) : null;
    const state = computeSequenceState({
      sentCount: r.sentCount ?? 0,
      lastSentAt,
      replied: r.replied ?? false,
    });
    if (state.done || state.nextStepIndex === null) continue; // hide replied/exhausted
    rows.push({
      movieId: r.movieId,
      contactId: r.contactId,
      movieTitle: r.title,
      contactName: r.name,
      contactOutlet: r.outlet,
      contactEmail: r.email,
      sentCount: state.sentCount,
      nextStepIndex: state.nextStepIndex,
      nextStepLabel: SEQUENCE_STEPS[state.nextStepIndex].label,
      due: state.due,
      dueAt: state.dueAt ? state.dueAt.toISOString() : null,
    });
  }

  // Due first (oldest due implied by sort), then upcoming by soonest dueAt.
  rows.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1;
    return (a.dueAt ?? "").localeCompare(b.dueAt ?? "");
  });

  const dueNow = rows.filter((r) => r.due).length;

  return (
    <>
      <PageHeader
        title="Pitch sequences"
        description={`A ${SEQUENCE_STEPS.length}-step cadence per press contact — the next touch is suggested automatically based on what's been sent and who's replied.`}
      />
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        {/* Cadence legend */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/50 px-4 py-3 text-xs dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <span className="font-medium text-zinc-500">Cadence:</span>
          {SEQUENCE_STEPS.map((s, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="rounded-full bg-white px-2 py-0.5 font-medium shadow-sm dark:bg-zinc-800">
                {i + 1}. {s.label}
              </span>
              {i < SEQUENCE_STEPS.length - 1 && (
                <span className="text-zinc-400">
                  → +{SEQUENCE_STEPS[i + 1].dayOffset}d
                </span>
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {dueNow} due now
          </span>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-500">{rows.length - dueNow} upcoming</span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <Workflow className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              No active sequences. Link press contacts to a film and start a
              pitch — the cadence picks up from there.
            </p>
          </div>
        ) : (
          <SequenceBoard rows={rows} />
        )}
      </div>
    </>
  );
}
