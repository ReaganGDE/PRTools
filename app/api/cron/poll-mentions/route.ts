import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { pollWorkspace } from "@/lib/sentiment/orchestrator";

// Vercel Cron will hit this hourly; also supports manual triggering with the
// CRON_SECRET. See vercel.json.
export const maxDuration = 300; // 5 min — sentiment polling can be slow
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev convenience
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wsRows = await db.select({ id: workspaces.id }).from(workspaces);
  const results = [];
  for (const ws of wsRows) {
    try {
      const r = await pollWorkspace(ws.id);
      results.push(r);
    } catch (e) {
      results.push({
        workspaceId: ws.id,
        error: (e as Error).message,
      });
    }
  }
  return NextResponse.json({ ok: true, results });
}

export const POST = GET;
