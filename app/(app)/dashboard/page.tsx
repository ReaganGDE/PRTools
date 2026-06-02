import Link from "next/link";
import { eq, desc, asc, count, and, gte, lte, or, sql } from "drizzle-orm";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Film,
  MessageSquare,
  Send,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  contacts,
  campaigns,
  sends,
  mentions,
  socialPosts,
  movies,
  brands,
  movieContacts,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { getActiveBrandId } from "@/lib/brand-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireSession();
  const wsId = session.workspaceId;
  const activeBrandId = await getActiveBrandId();

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const socialBrandFilter = activeBrandId
    ? and(
        eq(socialPosts.workspaceId, wsId),
        eq(socialPosts.brandId, activeBrandId),
      )!
    : eq(socialPosts.workspaceId, wsId);

  const [
    [{ value: contactCount }],
    [{ value: campaignCount }],
    [{ value: sendCount }],
    [{ value: mentionCount }],
    upcomingPosts,
    failedPosts,
    [{ value: queuedCount }],
    [{ value: negMentionCount }],
  ] = await Promise.all([
    db.select({ value: count() }).from(contacts).where(eq(contacts.workspaceId, wsId)),
    db.select({ value: count() }).from(campaigns).where(eq(campaigns.workspaceId, wsId)),
    db.select({ value: count() }).from(sends).where(eq(sends.workspaceId, wsId)),
    db.select({ value: count() }).from(mentions).where(eq(mentions.workspaceId, wsId)),
    db
      .select({
        id: socialPosts.id,
        title: socialPosts.title,
        body: socialPosts.body,
        platform: socialPosts.platform,
        scheduledAt: socialPosts.scheduledAt,
      })
      .from(socialPosts)
      .where(
        and(
          socialBrandFilter,
          eq(socialPosts.status, "scheduled"),
          gte(socialPosts.scheduledAt, now),
          lte(socialPosts.scheduledAt, weekEnd),
        ),
      )
      .orderBy(socialPosts.scheduledAt)
      .limit(5),
    db
      .select({
        id: socialPosts.id,
        title: socialPosts.title,
        body: socialPosts.body,
        platform: socialPosts.platform,
        error: socialPosts.error,
      })
      .from(socialPosts)
      .where(and(socialBrandFilter, eq(socialPosts.status, "failed")))
      .orderBy(desc(socialPosts.createdAt))
      .limit(5),
    db
      .select({ value: count() })
      .from(socialPosts)
      .where(
        and(
          socialBrandFilter,
          or(
            eq(socialPosts.status, "scheduled"),
            eq(socialPosts.status, "draft"),
          )!,
        ),
      ),
    db
      .select({ value: count() })
      .from(mentions)
      .where(
        and(
          eq(mentions.workspaceId, wsId),
          eq(mentions.sentimentLabel, "negative"),
        ),
      ),
  ]);

  // PR stats — movie counts by status
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const movieFilter = activeBrandId
    ? and(eq(movies.workspaceId, wsId), eq(movies.brandId, activeBrandId))
    : eq(movies.workspaceId, wsId);

  const [movieStats, screenerCount] = await Promise.all([
    db
      .select({ status: movies.status, count: count() })
      .from(movies)
      .where(movieFilter)
      .groupBy(movies.status),
    db
      .select({ value: count() })
      .from(movieContacts)
      .where(
        and(
          eq(movieContacts.workspaceId, wsId),
          sql`${movieContacts.screenerSentAt} IS NOT NULL`,
        ),
      )
      .then((r) => r[0]?.value ?? 0),
  ]);

  const statByStatus = Object.fromEntries(movieStats.map((r) => [r.status, r.count]));
  const totalMovies = movieStats.reduce((s, r) => s + r.count, 0);

  // Screeners outstanding — upcoming films with linked contacts who haven't
  // been sent a screener yet.
  const brandClause = activeBrandId
    ? sql`AND m.brand_id = ${activeBrandId}`
    : sql``;
  const screenersOutstanding = (await db.execute(sql`
    SELECT m.id, m.title, m.release_date AS "releaseDate",
           COUNT(mc.id)::int AS total,
           COUNT(mc.screener_sent_at)::int AS sent
    FROM movies m
    JOIN movie_contacts mc ON mc.movie_id = m.id
    WHERE m.workspace_id = ${wsId}
      AND (m.release_date >= ${now} OR m.status = 'pre_release')
      ${brandClause}
    GROUP BY m.id, m.title, m.release_date
    HAVING COUNT(mc.id) > COUNT(mc.screener_sent_at)
    ORDER BY m.release_date ASC NULLS LAST
    LIMIT 8
  `)) as unknown as {
    id: string;
    title: string;
    releaseDate: string | null;
    total: number;
    sent: number;
  }[];

  // Next release(s) — if a brand is active, just that brand's next upcoming
  // movie; if "all", show one upcoming movie from each brand.
  type UpcomingMovie = {
    id: string;
    title: string;
    posterUrl: string | null;
    releaseDate: Date;
    brandName: string | null;
    brandColor: string | null;
  };

  let upcomingMovies: UpcomingMovie[] = [];
  if (activeBrandId) {
    const rows = await db
      .select({
        id: movies.id,
        title: movies.title,
        posterUrl: movies.posterUrl,
        releaseDate: movies.releaseDate,
        brandName: brands.name,
        brandColor: brands.color,
      })
      .from(movies)
      .leftJoin(brands, eq(movies.brandId, brands.id))
      .where(
        and(
          eq(movies.workspaceId, wsId),
          eq(movies.brandId, activeBrandId),
          gte(movies.releaseDate, now),
        ),
      )
      .orderBy(asc(movies.releaseDate))
      .limit(1);
    upcomingMovies = rows
      .filter((r): r is typeof r & { releaseDate: Date } => r.releaseDate !== null);
  } else {
    // One per brand, picked via DISTINCT ON.
    const rows = (await db.execute(sql`
      SELECT DISTINCT ON (m.brand_id)
        m.id, m.title, m.poster_url AS "posterUrl", m.release_date AS "releaseDate",
        b.name AS "brandName", b.color AS "brandColor"
      FROM movies m
      LEFT JOIN brands b ON b.id = m.brand_id
      WHERE m.workspace_id = ${wsId}
        AND m.release_date >= ${now}
      ORDER BY m.brand_id, m.release_date ASC
    `)) as unknown as UpcomingMovie[];
    upcomingMovies = rows
      .filter((r) => r.releaseDate !== null)
      .map((r) => ({ ...r, releaseDate: new Date(r.releaseDate) }))
      .sort((a, b) => a.releaseDate.getTime() - b.releaseDate.getTime());
  }

  const firstName =
    session.email?.split("@")[0]?.split(".")[0] ?? "there";
  const displayName =
    firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <>
      <PageHeader
        title={`Good to see you, ${displayName}`}
        description="Here's what's happening across your workspace."
      />
      <div className="space-y-6 p-8">
        {/* Alerts */}
        {(failedPosts.length > 0 || negMentionCount > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {failedPosts.length > 0 && (
              <AlertBanner
                icon={<AlertTriangle className="h-4 w-4" />}
                color="red"
                title={`${failedPosts.length} failed post${failedPosts.length > 1 ? "s" : ""}`}
                description="Review and retry from the Social page."
                href="/social"
              />
            )}
            {negMentionCount > 0 && (
              <AlertBanner
                icon={<MessageSquare className="h-4 w-4" />}
                color="amber"
                title={`${negMentionCount} negative mention${negMentionCount > 1 ? "s" : ""}`}
                description="Review sentiment activity."
                href="/sentiment"
              />
            )}
          </div>
        )}

        {/* Screeners outstanding */}
        {screenersOutstanding.length > 0 && (
          <div>
            <SectionHeading
              icon={<Send className="h-4 w-4" />}
              label="Screeners outstanding"
            />
            <ul className="space-y-2">
              {screenersOutstanding.map((s) => {
                const remaining = s.total - s.sent;
                const rd = s.releaseDate ? new Date(s.releaseDate) : null;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/movies/${s.id}/pitch`}
                      className="group flex items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 text-sm transition-all hover:shadow-sm dark:border-amber-900/30 dark:bg-amber-950/20"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        <Send className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {s.title}
                        </span>
                        {rd && (
                          <span className="ml-2 text-xs text-zinc-500">
                            {rd.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {remaining} screener{remaining === 1 ? "" : "s"} to send
                        <span className="ml-1 text-amber-500/70">
                          ({s.sent}/{s.total} sent)
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-amber-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Next release(s) */}
        {upcomingMovies.length > 0 && (
          <div>
            <SectionHeading
              icon={<Film className="h-4 w-4" />}
              label={
                activeBrandId
                  ? "Next release"
                  : `Next release per brand (${upcomingMovies.length})`
              }
              action={
                <Link
                  href="/movies"
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  All movies →
                </Link>
              }
            />
            <div
              className={cn(
                "grid gap-3",
                upcomingMovies.length === 1
                  ? "sm:grid-cols-1"
                  : "sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {upcomingMovies.map((m) => (
                <NextReleaseCard key={m.id} movie={m} />
              ))}
            </div>
          </div>
        )}

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Upcoming posts */}
          <div className="lg:col-span-2">
            <SectionHeading
              icon={<Calendar className="h-4 w-4" />}
              label="Scheduled this week"
              action={
                <Link
                  href="/social?view=calendar"
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Open calendar →
                </Link>
              }
            />
            {upcomingPosts.length === 0 ? (
              <EmptyQueue />
            ) : (
              <ul className="space-y-2">
                {upcomingPosts.map((p) => (
                  <UpcomingPostRow key={p.id} post={p} />
                ))}
              </ul>
            )}
          </div>

          {/* Side stats */}
          <div className="space-y-3">
            <StatCard
              icon={<Clock className="h-4 w-4 text-blue-500" />}
              label="In queue"
              value={queuedCount}
              sub="draft + scheduled"
              href="/social"
            />
            <StatCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              label="Messages sent"
              value={sendCount}
              sub="all time"
            />
            <StatCard
              icon={<Users className="h-4 w-4 text-violet-500" />}
              label="Contacts"
              value={contactCount}
              href="/contacts"
            />
          </div>
        </div>

        {/* Bottom mini-stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Campaigns" value={campaignCount} href="/outreach" />
          <MiniStat label="Mentions tracked" value={mentionCount} href="/sentiment" />
          <MiniStat label="Contacts" value={contactCount} href="/contacts" />
          <MiniStat label="Messages sent" value={sendCount} />
        </div>

        {/* PR stats */}
        {totalMovies > 0 && (
          <div>
            <SectionHeading
              icon={<Film className="h-4 w-4" />}
              label="Film slate"
              action={
                <Link
                  href="/movies"
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  All movies →
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Total films" value={totalMovies} href="/movies" />
              <MiniStat
                label="In production"
                value={statByStatus["in_production"] ?? 0}
                href="/movies?status=in_production"
              />
              <MiniStat
                label="Pre-release"
                value={statByStatus["pre_release"] ?? 0}
                href="/movies?status=pre_release"
              />
              <MiniStat
                label="Screeners sent"
                value={screenerCount}
                href="/movies"
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function AlertBanner({
  icon,
  color,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  color: "red" | "amber";
  title: string;
  description: string;
  href: string;
}) {
  const styles = {
    red: {
      wrap: "border-red-200/80 bg-red-50 hover:bg-red-100/60 dark:border-red-900/30 dark:bg-red-950/20",
      icon: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    },
    amber: {
      wrap: "border-amber-200/80 bg-amber-50 hover:bg-amber-100/60 dark:border-amber-900/30 dark:bg-amber-950/20",
      icon: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    },
  }[color];
  return (
    <Link
      href={href}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 transition-all duration-150",
        styles.wrap,
      )}
    >
      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <ChevronRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-zinc-400" />
    </Link>
  );
}

function SectionHeading({
  icon,
  label,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
        {icon}
        {label}
      </div>
      {action}
    </div>
  );
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300",
  facebook: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  youtube: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  reddit: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  tiktok: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100",
  x: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  linkedin: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  multi: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
};

function UpcomingPostRow({
  post,
}: {
  post: {
    id: string;
    title: string | null;
    body: string;
    platform: string;
    scheduledAt: Date | null;
  };
}) {
  const colorCls = PLATFORM_COLORS[post.platform] ?? PLATFORM_COLORS.multi;
  return (
    <li>
      <Link
        href={`/social/${post.id}`}
        className="group flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 text-sm shadow-sm transition-all duration-150 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900"
      >
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", colorCls)}>
          {post.platform}
        </span>
        <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
          {post.title || post.body}
        </span>
        {post.scheduledAt && (
          <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
            {post.scheduledAt.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </li>
  );
}

function EmptyQueue() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-500">Nothing scheduled this week</p>
      <p className="mt-0.5 text-xs text-zinc-400">Posts you schedule will appear here.</p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/social/new">Create a post</Link>
      </Button>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        {sub && <p className="text-[10px] text-zinc-400">{sub}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-all duration-150 hover:scale-[1.01]">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function NextReleaseCard({
  movie,
}: {
  movie: {
    id: string;
    title: string;
    posterUrl: string | null;
    releaseDate: Date;
    brandName: string | null;
    brandColor: string | null;
  };
}) {
  const daysUntil = Math.ceil(
    (movie.releaseDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  const dateLabel = movie.releaseDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <Link
      href={`/movies/${movie.id}`}
      className="group flex gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm transition-all duration-150 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900"
    >
      <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-6 w-6 text-zinc-400" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {movie.brandName && (
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: movie.brandColor ?? "#888" }}
            />
            <span className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {movie.brandName}
            </span>
          </div>
        )}
        <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {movie.title}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{dateLabel}</p>
        <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
          {daysUntil === 0
            ? "Releases today"
            : daysUntil === 1
              ? "Tomorrow"
              : `In ${daysUntil} days`}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 self-center text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function MiniStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}
