import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sends } from "@/lib/db/schema";
import { suppress } from "@/app/(app)/email/actions";

// Resend webhook event format:
// {
//   "type": "email.sent" | "email.delivered" | "email.opened" | "email.clicked" |
//           "email.bounced" | "email.complained" | "email.delivery_delayed",
//   "created_at": "2024-...",
//   "data": {
//     "email_id": "abc-123",
//     "to": ["foo@bar.com"],
//     "from": "press@yourdomain.com",
//     "subject": "...",
//     "tags": [{ "name": "campaign_id", "value": "..." }, ...]
//   }
// }

export async function POST(req: Request) {
  // Optional shared-secret check via header (set this same value in Resend dashboard)
  const expected = process.env.RESEND_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get("x-webhook-secret");
    if (got !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: {
    type?: string;
    data?: {
      email_id?: string;
      to?: string[];
      tags?: { name: string; value: string }[];
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const externalId = body.data?.email_id;
  if (!externalId) return NextResponse.json({ ok: true });

  const [send] = await db
    .select()
    .from(sends)
    .where(eq(sends.externalId, externalId))
    .limit(1);

  if (!send) {
    // Webhook for a send we don't know about — ignore
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  const patch: Partial<typeof sends.$inferInsert> = {};

  switch (body.type) {
    case "email.delivered":
      patch.status = "delivered";
      break;
    case "email.opened":
      patch.status = "opened";
      patch.openedAt = send.openedAt ?? now;
      break;
    case "email.clicked":
      patch.status = "clicked";
      patch.clickedAt = send.clickedAt ?? now;
      patch.openedAt = send.openedAt ?? now;
      break;
    case "email.bounced":
      patch.status = "bounced";
      patch.error = "Bounced";
      if (body.data?.to?.[0]) {
        await suppress({
          workspaceId: send.workspaceId,
          email: body.data.to[0],
          reason: "bounce",
        });
      }
      break;
    case "email.complained":
      patch.status = "bounced";
      patch.error = "Spam complaint";
      if (body.data?.to?.[0]) {
        await suppress({
          workspaceId: send.workspaceId,
          email: body.data.to[0],
          reason: "complaint",
        });
      }
      break;
  }

  if (Object.keys(patch).length > 0) {
    await db.update(sends).set(patch).where(eq(sends.id, send.id));
  }

  return NextResponse.json({ ok: true });
}
