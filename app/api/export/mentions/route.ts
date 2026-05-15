import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { mentions } from "@/lib/db/schema";
import { requireSessionWithCap } from "@/lib/auth-helpers";
import { csvResponse, toCsv } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

const MAX_ROWS = 10_000;

export async function GET(req: Request) {
  const session = await requireSessionWithCap("export.mentions");
  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  const days = daysParam ? Math.max(1, Math.min(365, Number(daysParam))) : 30;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const conds = [
    eq(mentions.workspaceId, session.workspaceId),
    gte(mentions.publishedAt, since),
  ];

  const rows = await db
    .select({
      publishedAt: mentions.publishedAt,
      source: mentions.source,
      title: mentions.title,
      author: mentions.author,
      url: mentions.url,
      sentimentLabel: mentions.sentimentLabel,
      sentimentScore: mentions.sentimentScore,
      keywordMatched: mentions.keywordMatched,
    })
    .from(mentions)
    .where(and(...conds))
    .orderBy(desc(mentions.publishedAt))
    .limit(MAX_ROWS);

  await logAudit({
    workspaceId: session.workspaceId,
    userId: session.userId,
    action: "export.mentions",
    meta: { count: rows.length, days },
  });

  const csv = toCsv(rows, [
    { key: "publishedAt", header: "Published at" },
    { key: "source", header: "Source" },
    { key: "title", header: "Title" },
    { key: "author", header: "Author" },
    { key: "url", header: "URL" },
    { key: "sentimentLabel", header: "Sentiment" },
    { key: "sentimentScore", header: "Score" },
    { key: "keywordMatched", header: "Keyword" },
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(`mentions-${days}d-${today}.csv`, csv);
}
