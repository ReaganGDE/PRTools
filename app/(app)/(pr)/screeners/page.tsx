import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { movieContacts, movies, contacts } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { requireSectionAccess } from "@/lib/tool-access";
import { PageHeader } from "@/components/page-header";
import { Clapperboard } from "lucide-react";
import { ScreenerQueue } from "./screener-queue";

export default async function ScreenersPage() {
  await requireSectionAccess("pr");
  const session = await requireSession();

  // Everything not yet resolved (sent / declined / never asked) — i.e. the
  // active pipeline of screener requests that need attention. Oldest first.
  const rows = await db
    .select({
      movieId: movieContacts.movieId,
      contactId: movieContacts.contactId,
      status: movieContacts.screenerStatus,
      createdAt: movieContacts.createdAt,
      movieTitle: movies.title,
      moviePoster: movies.posterUrl,
      contactName: contacts.name,
      contactOutlet: contacts.outlet,
      contactEmail: contacts.email,
    })
    .from(movieContacts)
    .innerJoin(movies, eq(movies.id, movieContacts.movieId))
    .innerJoin(contacts, eq(contacts.id, movieContacts.contactId))
    .where(
      and(
        eq(movieContacts.workspaceId, session.workspaceId),
        inArray(movieContacts.screenerStatus, ["requested", "approved"]),
      ),
    )
    .orderBy(asc(movieContacts.createdAt));

  const requested = rows.filter((r) => r.status === "requested").length;
  const approved = rows.filter((r) => r.status === "approved").length;

  return (
    <>
      <PageHeader
        title="Screener requests"
        description="Pending screener requests across every film, oldest first."
      />
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
          <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Requested</div>
            <div className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">{requested}</div>
          </div>
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Approved, not sent</div>
            <div className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-100">{approved}</div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <Clapperboard className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              No pending screener requests. Mark a press contact as
              &quot;Requested&quot; on a film page and it&apos;ll show up here.
            </p>
          </div>
        ) : (
          <ScreenerQueue
            rows={rows.map((r) => ({
              movieId: r.movieId,
              contactId: r.contactId,
              status: r.status as "requested" | "approved",
              movieTitle: r.movieTitle,
              contactName: r.contactName,
              contactOutlet: r.contactOutlet,
              contactEmail: r.contactEmail,
              requestedAt: r.createdAt?.toISOString() ?? null,
            }))}
          />
        )}
      </div>
    </>
  );
}
