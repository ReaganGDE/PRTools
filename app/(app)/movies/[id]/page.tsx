import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  ChevronLeft,
  Film,
  Calendar,
  ExternalLink,
  Clock,
  Globe,
  Building2,
  Tag,
  Pencil,
  Send,
  UserPlus,
  X,
  Newspaper,
  ThumbsUp,
  Minus,
  ThumbsDown,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  movies,
  brands,
  socialPosts,
  movieContacts,
  contacts,
  contactLists,
  movieCoverages,
  campaigns,
  sends,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addMovieContact,
  addContactsFromList,
  removeMovieContact,
  toggleScreenerSent,
} from "./press-actions";
import { addMovieCoverage, removeMovieCoverage } from "./coverage-actions";

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [[row], moviePosts, pressContacts, allContacts, coverages] = await Promise.all([
    db
      .select({ movie: movies, brandName: brands.name, brandColor: brands.color })
      .from(movies)
      .leftJoin(brands, eq(brands.id, movies.brandId))
      .where(
        and(eq(movies.id, id), eq(movies.workspaceId, session.workspaceId)),
      ),
    db
      .select()
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.movieId, id),
          eq(socialPosts.workspaceId, session.workspaceId),
        ),
      )
      .orderBy(desc(socialPosts.createdAt))
      .limit(10),
    db
      .select({
        mc: movieContacts,
        contactName: contacts.name,
        contactOutlet: contacts.outlet,
        contactBeat: contacts.beat,
        contactEmail: contacts.email,
      })
      .from(movieContacts)
      .innerJoin(contacts, eq(movieContacts.contactId, contacts.id))
      .where(eq(movieContacts.movieId, id))
      .orderBy(movieContacts.createdAt),
    db
      .select({ id: contacts.id, name: contacts.name, outlet: contacts.outlet })
      .from(contacts)
      .where(eq(contacts.workspaceId, session.workspaceId))
      .orderBy(contacts.name),
    db
      .select()
      .from(movieCoverages)
      .where(eq(movieCoverages.movieId, id))
      .orderBy(desc(movieCoverages.publishedAt)),
  ]);

  const lists = await db
    .select({ id: contactLists.id, name: contactLists.name })
    .from(contactLists)
    .where(eq(contactLists.workspaceId, session.workspaceId))
    .orderBy(contactLists.name);

  // Aggregate pitch performance across every pitch campaign for this film.
  const pitchStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${sends.sentAt} is not null)::int`,
      opened: sql<number>`count(*) filter (where ${sends.openedAt} is not null)::int`,
      clicked: sql<number>`count(*) filter (where ${sends.clickedAt} is not null)::int`,
      replied: sql<number>`count(*) filter (where ${sends.repliedAt} is not null)::int`,
    })
    .from(sends)
    .innerJoin(campaigns, eq(sends.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.movieId, id),
        eq(campaigns.workspaceId, session.workspaceId),
      ),
    )
    .then((r) => r[0]);

  if (!row) notFound();
  const m = row.movie;

  return (
    <>
      <PageHeader
        title={m.title}
        description={m.tagline ?? m.logline ?? undefined}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/movies/${m.id}/edit`}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl p-8">
        <div className="mb-6">
          <Link
            href="/movies"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" /> Back to movies
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Poster + quick facts column */}
          <div className="space-y-4">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-100 shadow-sm dark:bg-zinc-900">
              {m.posterUrl ? (
                <Image
                  src={m.posterUrl}
                  alt={m.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Film className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                </div>
              )}
              <StatusBadge status={m.status} />
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-white p-4 text-sm shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
              {row.brandName && (
                <div className="mb-3 flex items-center gap-2">
                  {row.brandColor && (
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: row.brandColor }}
                    />
                  )}
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {row.brandName}
                  </span>
                </div>
              )}
              <dl className="space-y-2">
                <Fact label="Studio" value={m.studio} />
                <Fact label="Distributor" value={m.distributor} />
                <Fact label="Rights" value={m.rights} />
                <Fact label="Territory" value={m.territory} />
                <Fact label="Rating" value={m.mpaaRating} />
                <Fact
                  label="Runtime"
                  value={m.runtime ? `${m.runtime} min` : null}
                />
                <Fact label="Language" value={m.language} />
              </dl>
            </div>

            {(m.theatricalDate || m.tvodDate || m.avodDate) && (
              <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Release windows
                </h3>
                <ul className="space-y-1.5 text-sm">
                  <ReleaseRow label="Theatrical" date={m.theatricalDate} />
                  <ReleaseRow label="TVOD" date={m.tvodDate} />
                  <ReleaseRow label="AVOD" date={m.avodDate} />
                </ul>
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="space-y-6">
            {(m.logline || m.synopsis) && (
              <section className="space-y-3">
                {m.logline && (
                  <p className="text-base font-medium leading-snug">
                    {m.logline}
                  </p>
                )}
                {m.synopsis && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {m.synopsis}
                  </p>
                )}
              </section>
            )}

            {m.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium dark:bg-zinc-800"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {(m.director || m.writer || m.producer || m.castList) && (
              <Section title="Credits">
                <CreditRow label="Director" value={m.director} />
                <CreditRow label="Writer" value={m.writer} />
                <CreditRow label="Producer" value={m.producer} />
                <CreditRow label="Cast" value={m.castList} />
              </Section>
            )}

            {(m.imdbUrl ||
              m.websiteUrl ||
              m.trailerUrl ||
              m.screenerUrl ||
              m.pressKitUrl ||
              m.socialMediaUrl) && (
              <Section title="Links">
                <div className="grid gap-2 sm:grid-cols-2">
                  <LinkPill label="Trailer" href={m.trailerUrl} />
                  <LinkPill label="Screener" href={m.screenerUrl} />
                  <LinkPill label="IMDB" href={m.imdbUrl} />
                  <LinkPill label="Website" href={m.websiteUrl} />
                  <LinkPill label="Press kit" href={m.pressKitUrl} />
                  <LinkPill label="Social" href={m.socialMediaUrl} />
                </div>
                {(m.trailerPassword || m.screenerPassword) && (
                  <div className="mt-3 space-y-1 text-xs text-zinc-500">
                    {m.trailerPassword && (
                      <div>
                        Trailer password:{" "}
                        <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                          {m.trailerPassword}
                        </code>
                      </div>
                    )}
                    {m.screenerPassword && (
                      <div>
                        Screener password:{" "}
                        <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                          {m.screenerPassword}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </Section>
            )}

            {(m.productionCompany || m.compTitles || m.copyrightLine) && (
              <Section title="Production">
                <CreditRow label="Production co." value={m.productionCompany} />
                <CreditRow label="Comp titles" value={m.compTitles} />
                <CreditRow label="Copyright" value={m.copyrightLine} />
              </Section>
            )}

            {/* Pitch performance */}
            {pitchStats && pitchStats.total > 0 && (
              <Section title="Pitch performance">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <PitchStat label="Sent" value={pitchStats.sent} />
                  <PitchStat
                    label="Opened"
                    value={pitchStats.opened}
                    pct={
                      pitchStats.sent > 0
                        ? Math.round((pitchStats.opened / pitchStats.sent) * 100)
                        : null
                    }
                    tone="blue"
                  />
                  <PitchStat
                    label="Clicked"
                    value={pitchStats.clicked}
                    pct={
                      pitchStats.sent > 0
                        ? Math.round((pitchStats.clicked / pitchStats.sent) * 100)
                        : null
                    }
                    tone="violet"
                  />
                  <PitchStat
                    label="Replied"
                    value={pitchStats.replied}
                    pct={
                      pitchStats.sent > 0
                        ? Math.round((pitchStats.replied / pitchStats.sent) * 100)
                        : null
                    }
                    tone="emerald"
                  />
                </div>
              </Section>
            )}

            {/* Press contacts */}
            <Section title={`Press contacts${pressContacts.length > 0 ? ` (${pressContacts.length})` : ""}`}>
              {pressContacts.length > 0 && (
                <div className="-mt-2 mb-3 flex items-center justify-end">
                  <Link
                    href={`/movies/${m.id}/pitch`}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    <Send className="h-3 w-3" /> Send pitch
                  </Link>
                </div>
              )}
              {pressContacts.length > 0 && (
                <ul className="mb-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {pressContacts.map(({ mc, contactName, contactOutlet, contactBeat, contactEmail }) => (
                    <li key={mc.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/contacts/${mc.contactId}`}
                          className="font-medium hover:underline"
                        >
                          {contactName}
                        </Link>
                        {(contactOutlet || contactBeat) && (
                          <p className="truncate text-xs text-zinc-500">
                            {[contactOutlet, contactBeat].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {contactEmail && (
                          <p className="text-xs text-zinc-400">{contactEmail}</p>
                        )}
                      </div>
                      <form action={toggleScreenerSent.bind(null, id, mc.contactId)}>
                        <button
                          type="submit"
                          title={mc.screenerSentAt ? "Mark screener not sent" : "Mark screener sent"}
                          className={cn(
                            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                            mc.screenerSentAt
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
                          )}
                        >
                          <Send className="h-2.5 w-2.5" />
                          {mc.screenerSentAt
                            ? `Sent ${mc.screenerSentAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                            : "Screener?"}
                        </button>
                      </form>
                      <form action={removeMovieContact.bind(null, id, mc.contactId)}>
                        <button
                          type="submit"
                          title="Remove"
                          className="rounded p-1 text-zinc-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {/* Add contact form */}
              {(() => {
                const linkedIds = new Set(pressContacts.map((pc) => pc.mc.contactId));
                const unlinked = allContacts.filter((c) => !linkedIds.has(c.id));
                if (unlinked.length === 0) return null;
                return (
                  <form action={addMovieContact.bind(null, id)} className="flex gap-2">
                    <select
                      name="contactId"
                      className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <option value="">Add a press contact…</option>
                      {unlinked.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.outlet ? ` — ${c.outlet}` : ""}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">
                      <UserPlus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </form>
                );
              })()}
              {lists.length > 0 && (
                <form
                  action={addContactsFromList.bind(null, id)}
                  className="mt-2 flex gap-2"
                >
                  <select
                    name="listId"
                    className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="">Add everyone from a list…</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="outline">
                    <UserPlus className="h-3.5 w-3.5" /> Add list
                  </Button>
                </form>
              )}
              {pressContacts.length === 0 && allContacts.length === 0 && (
                <p className="text-sm text-zinc-500">
                  No contacts yet.{" "}
                  <Link href="/contacts" className="text-red-600 hover:underline dark:text-red-400">
                    Add contacts
                  </Link>{" "}
                  first.
                </p>
              )}
            </Section>

            {/* Press coverage */}
            <Section title={`Coverage${coverages.length > 0 ? ` (${coverages.length})` : ""}`}>
              {coverages.length > 0 && (
                <ul className="mb-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {coverages.map((cov) => (
                    <li key={cov.id} className="flex items-start gap-3 py-3 text-sm">
                      <div className="mt-0.5 shrink-0">
                        {cov.sentiment === "positive" ? (
                          <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                        ) : cov.sentiment === "negative" ? (
                          <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-zinc-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {cov.headline ? (
                          cov.url ? (
                            <a
                              href={cov.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:underline"
                            >
                              {cov.headline}
                            </a>
                          ) : (
                            <span className="font-medium">{cov.headline}</span>
                          )
                        ) : cov.url ? (
                          <a
                            href={cov.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-xs text-zinc-500 hover:underline"
                          >
                            {cov.url}
                          </a>
                        ) : null}
                        <p className="text-xs text-zinc-500">
                          {[
                            cov.outlet,
                            cov.publishedAt
                              ? cov.publishedAt.toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {cov.notes && (
                          <p className="mt-0.5 text-xs text-zinc-400">{cov.notes}</p>
                        )}
                      </div>
                      <form action={removeMovieCoverage.bind(null, id, cov.id)}>
                        <button
                          type="submit"
                          title="Remove"
                          className="shrink-0 rounded p-1 text-zinc-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addMovieCoverage.bind(null, id)} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="outlet"
                    placeholder="Outlet (e.g. Variety)"
                    className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                  />
                  <input
                    name="publishedAt"
                    type="date"
                    className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
                <input
                  name="headline"
                  placeholder="Headline"
                  className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                />
                <div className="flex gap-2">
                  <input
                    name="url"
                    type="url"
                    placeholder="URL (optional)"
                    className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                  />
                  <select
                    name="sentiment"
                    className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="">Sentiment</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                  <Button type="submit" size="sm" variant="outline">
                    <Newspaper className="h-3.5 w-3.5" /> Log
                  </Button>
                </div>
              </form>
            </Section>

            {/* Recent posts for this movie */}
            <Section title="Recent posts">
              <div className="-mt-2 mb-3 flex items-center justify-end">
                <Link
                  href={`/social/new?movieId=${m.id}`}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  New post <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              {moviePosts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                  No social posts yet for this movie.
                </p>
              ) : (
                <ul className="space-y-2">
                  {moviePosts.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/social/${p.id}`}
                        className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium capitalize dark:bg-zinc-800 dark:text-zinc-200">
                          {p.platform}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {p.title || p.body}
                        </span>
                        {p.scheduledAt && (
                          <span className="shrink-0 text-[11px] text-zinc-400">
                            <Calendar className="mr-1 inline h-3 w-3" />
                            {p.scheduledAt.toLocaleDateString()}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {m.airtableSyncedAt && (
              <p className="text-xs text-zinc-400">
                Synced from Airtable {m.airtableSyncedAt.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
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
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
        {children}
      </div>
    </section>
  );
}

function PitchStat({
  label,
  value,
  pct,
  tone = "zinc",
}: {
  label: string;
  value: number;
  pct?: number | null;
  tone?: "zinc" | "blue" | "violet" | "emerald";
}) {
  const toneClasses: Record<string, string> = {
    zinc: "text-zinc-900 dark:text-zinc-100",
    blue: "text-blue-600 dark:text-blue-400",
    violet: "text-violet-600 dark:text-violet-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <div className="rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-800/60">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClasses[tone])}>
        {value}
      </div>
      {pct != null && (
        <div className="text-xs text-zinc-400">{pct}% of sent</div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="truncate text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function CreditRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-800/50">
      <span className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function ReleaseRow({ label, date }: { label: string; date: Date | null }) {
  if (!date) return null;
  return (
    <li className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-medium">
        {date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </span>
    </li>
  );
}

function LinkPill({ label, href }: { label: string; href: string | null }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm transition-colors hover:border-red-300 hover:bg-red-50/40 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-red-900 dark:hover:bg-red-950/20"
    >
      <span className="font-medium">{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace("_", " ");
  const cls =
    status === "released"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "pre_release"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : status === "archived"
          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  return (
    <span
      className={cn(
        "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        cls,
      )}
    >
      {label}
    </span>
  );
}
