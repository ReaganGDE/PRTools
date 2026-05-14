import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { keywords, mentions } from "@/lib/db/schema";
import { fetchNews } from "./sources/news";
import { fetchReddit } from "./sources/reddit";
import { fetchYouTube } from "./sources/youtube";
import { scoreMentions, hashUrl } from "./score";
import type { FetchedMention } from "./sources/news";

export type PollResult = {
  workspaceId: string;
  fetched: number;
  inserted: number;
  scored: number;
  errors: string[];
};

export async function pollWorkspace(workspaceId: string): Promise<PollResult> {
  const errors: string[] = [];

  const kws = await db
    .select()
    .from(keywords)
    .where(
      and(
        eq(keywords.workspaceId, workspaceId),
        eq(keywords.active, true),
      ),
    );

  if (kws.length === 0)
    return { workspaceId, fetched: 0, inserted: 0, scored: 0, errors };

  const fetched: FetchedMention[] = [];

  for (const k of kws) {
    if (process.env.NEWS_API_KEY) {
      try {
        const news = await fetchNews(k.term, process.env.NEWS_API_KEY);
        fetched.push(...news);
      } catch (e) {
        errors.push(`news[${k.term}]: ${(e as Error).message}`);
      }
    }
    if (
      process.env.REDDIT_CLIENT_ID &&
      process.env.REDDIT_CLIENT_SECRET &&
      process.env.REDDIT_USER_AGENT
    ) {
      try {
        const reddit = await fetchReddit(k.term, {
          clientId: process.env.REDDIT_CLIENT_ID,
          clientSecret: process.env.REDDIT_CLIENT_SECRET,
          userAgent: process.env.REDDIT_USER_AGENT,
        });
        fetched.push(...reddit);
      } catch (e) {
        errors.push(`reddit[${k.term}]: ${(e as Error).message}`);
      }
    }
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const yt = await fetchYouTube(k.term, process.env.YOUTUBE_API_KEY);
        fetched.push(...yt);
      } catch (e) {
        errors.push(`youtube[${k.term}]: ${(e as Error).message}`);
      }
    }
  }

  // Dedup against existing (workspace, urlHash)
  const newRecords: (typeof mentions.$inferInsert & { __key: string })[] = [];
  for (const f of fetched) {
    const urlHash = hashUrl(f.url);
    newRecords.push({
      workspaceId,
      source: f.source,
      url: f.url,
      urlHash,
      title: f.title,
      body: f.body,
      author: f.author,
      publishedAt: f.publishedAt,
      keywordMatched: f.keywordMatched,
      __key: urlHash,
    });
  }

  let inserted = 0;
  const insertedIds: { id: string; title: string | null; body: string | null }[] =
    [];

  // Insert with conflict-do-nothing on (workspace_id, url_hash)
  for (const rec of newRecords) {
    const { __key, ...row } = rec;
    void __key;
    const result = await db
      .insert(mentions)
      .values(row)
      .onConflictDoNothing({
        target: [mentions.workspaceId, mentions.urlHash],
      })
      .returning({
        id: mentions.id,
        title: mentions.title,
        body: mentions.body,
      });
    if (result.length > 0) {
      inserted++;
      insertedIds.push(result[0]);
    }
  }

  let scored = 0;
  // Score newly inserted mentions in batches of 20
  for (let i = 0; i < insertedIds.length; i += 20) {
    const batch = insertedIds.slice(i, i + 20);
    try {
      const scores = await scoreMentions(batch);
      for (const [id, result] of Object.entries(scores)) {
        await db
          .update(mentions)
          .set({
            sentimentScore: result.score,
            sentimentLabel: result.label,
          })
          .where(eq(mentions.id, id));
        scored++;
      }
    } catch (e) {
      errors.push(`scoring: ${(e as Error).message}`);
    }
  }

  return {
    workspaceId,
    fetched: fetched.length,
    inserted,
    scored,
    errors,
  };
}
