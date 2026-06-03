"use server";
import { revalidatePath } from "next/cache";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { contacts, movies, movieCoverages } from "@/lib/db/schema";
import { requireSession, requireSessionWithCap } from "@/lib/auth-helpers";
import { assertSectionAccess } from "@/lib/tool-access";
import { env } from "@/lib/env";
import { fetchJournalistArticles } from "@/lib/integrations/journalist-finder";

export type ExistingContact = {
  id: string;
  name: string;
  outlet: string | null;
  beat: string | null;
  email: string | null;
};

export type DiscoveredJournalist = {
  name: string;
  outlet: string | null;
  latestHeadline: string | null;
  latestUrl: string | null;
  publishedAt: string | null;
  articleCount: number;
  alreadyInDb: boolean;
};

export type PrFinderResult = {
  existing: ExistingContact[];
  discovered: DiscoveredJournalist[];
  newsEnabled: boolean;
  note: string | null;
};

// Author strings from NewsAPI are noisy: drop bylines that are clearly an
// outlet name, a URL, or generic ("Staff"). Returns a cleaned person name or
// null to skip.
function cleanAuthor(raw: string | null): string | null {
  if (!raw) return null;
  let a = raw.trim();
  if (!a) return null;
  // Take the first author if comma/and-separated.
  a = a.split(/,| and /i)[0].trim();
  if (a.length < 3 || a.length > 60) return null;
  if (/https?:\/\//i.test(a)) return null;
  if (/^(staff|editor|admin|news\s?desk|newsroom|the\s)/i.test(a)) return null;
  if (!/\s/.test(a)) return null; // require at least two words (first + last)
  return a;
}

export async function searchPrContacts(
  formData: FormData,
): Promise<PrFinderResult> {
  await assertSectionAccess("pr");
  const session = await requireSession();
  const query = String(formData.get("query") ?? "").trim();
  const newsEnabled = Boolean(env.NEWS_API_KEY);

  if (!query) {
    return { existing: [], discovered: [], newsEnabled, note: null };
  }

  const like = `%${query}%`;

  // 1) Internal contacts matching name / outlet / beat.
  const existing = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      outlet: contacts.outlet,
      beat: contacts.beat,
      email: contacts.email,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.workspaceId, session.workspaceId),
        or(
          ilike(contacts.name, like),
          ilike(contacts.outlet, like),
          ilike(contacts.beat, like),
        ),
      ),
    )
    .orderBy(contacts.name)
    .limit(25);

  // 2) Discover journalists via NewsAPI.
  let discovered: DiscoveredJournalist[] = [];
  let note: string | null = null;
  if (newsEnabled) {
    try {
      const articles = await fetchJournalistArticles(query, env.NEWS_API_KEY!);
      const byAuthor = new Map<
        string,
        { outlet: string | null; headline: string | null; url: string | null; publishedAt: Date | null; count: number }
      >();
      for (const a of articles) {
        const author = cleanAuthor(a.author);
        if (!author) continue;
        const prev = byAuthor.get(author);
        if (prev) {
          prev.count++;
          if (!prev.outlet && a.outlet) prev.outlet = a.outlet;
          // keep the most recent article as the representative one
          if (a.publishedAt && (!prev.publishedAt || a.publishedAt > prev.publishedAt)) {
            prev.headline = a.title;
            prev.url = a.url;
            prev.publishedAt = a.publishedAt;
          }
        } else {
          byAuthor.set(author, {
            outlet: a.outlet,
            headline: a.title,
            url: a.url,
            publishedAt: a.publishedAt,
            count: 1,
          });
        }
      }

      // Flag which discovered journalists already exist (case-insensitive name).
      const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
      discovered = Array.from(byAuthor.entries())
        .map(([name, v]) => ({
          name,
          outlet: v.outlet,
          latestHeadline: v.headline,
          latestUrl: v.url,
          publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
          articleCount: v.count,
          alreadyInDb: existingNames.has(name.toLowerCase()),
        }))
        .sort((a, b) => b.articleCount - a.articleCount);
    } catch {
      note = "NewsAPI request failed. Try again shortly.";
    }
  } else {
    note = "Set NEWS_API_KEY to discover new journalists by topic.";
  }

  return { existing, discovered, newsEnabled, note };
}

export type AddJournalistResult = { added: boolean; reason?: string };

export async function addJournalistContact(
  formData: FormData,
): Promise<AddJournalistResult> {
  const session = await requireSessionWithCap("contacts.create");
  await assertSectionAccess("pr");

  const name = String(formData.get("name") ?? "").trim();
  const outlet = String(formData.get("outlet") ?? "").trim() || null;
  const beat = String(formData.get("beat") ?? "").trim() || null;
  if (!name) return { added: false, reason: "Missing name" };

  // De-dupe by name within the workspace.
  const [dupe] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.workspaceId, session.workspaceId),
        sql`lower(${contacts.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  if (dupe) return { added: false, reason: "Already in contacts" };

  await db.insert(contacts).values({
    id: nanoid(16),
    workspaceId: session.workspaceId,
    type: "journalist",
    name,
    outlet,
    beat,
    primaryPlatform: "email",
    source: "news_discover",
  });

  revalidatePath("/pr-finder");
  revalidatePath("/contacts");
  return { added: true };
}

/* ──────── Coverage logging from the finder ──────── */

export type MovieOption = { id: string; title: string };

export async function listMoviesForFinder(): Promise<MovieOption[]> {
  await assertSectionAccess("pr");
  const session = await requireSession();
  return db
    .select({ id: movies.id, title: movies.title })
    .from(movies)
    .where(eq(movies.workspaceId, session.workspaceId))
    .orderBy(movies.title);
}

export type LogCoverageResult = { ok: boolean };

export async function logCoverageFromFinder(
  formData: FormData,
): Promise<LogCoverageResult> {
  const session = await requireSession();
  await assertSectionAccess("pr");

  const movieId = String(formData.get("movieId") ?? "").trim();
  if (!movieId) return { ok: false };

  const headline = String(formData.get("headline") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim() || null;
  const outlet = String(formData.get("outlet") ?? "").trim() || null;
  const publishedAtRaw = String(formData.get("publishedAt") ?? "").trim();
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : null;
  const sentiment =
    (formData.get("sentiment") as "positive" | "neutral" | "negative" | null) ||
    null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const contactId = String(formData.get("contactId") ?? "").trim() || null;

  await db.insert(movieCoverages).values({
    id: nanoid(16),
    workspaceId: session.workspaceId,
    movieId,
    contactId,
    outlet,
    headline,
    url,
    publishedAt,
    sentiment,
    notes,
    addedBy: session.userId,
  });

  revalidatePath(`/movies/${movieId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
