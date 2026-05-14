import { NextResponse } from "next/server";
import { runDuePostsForAllWorkspaces } from "@/app/(app)/social/actions";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDuePostsForAllWorkspaces();
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
