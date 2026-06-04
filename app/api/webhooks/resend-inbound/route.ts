import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { recordInboundReply, parseCampaignIdFromHeaders } from "@/lib/email/inbound";

/**
 * Inbound email webhook — automatic reply detection.
 *
 * Resend (and most inbound-email providers, e.g. SendGrid Inbound Parse,
 * Postmark, Cloudflare Email Workers) POST a JSON payload when an email arrives
 * at a configured inbound address. Point your inbound route at this endpoint and
 * incoming replies will mark the matching pitch send as "replied" automatically.
 *
 * Setup (one-time, outside the app — you control DNS):
 *   1. Add an MX record for an inbound subdomain (e.g. reply.yourdomain.com).
 *   2. In your provider, route that address to this webhook URL.
 *   3. Optionally set RESEND_WEBHOOK_SECRET and send it as `x-webhook-secret`.
 *   4. Use that inbound address as the Reply-To on outgoing pitches so replies
 *      land here. (We already stamp X-Campaign-Id for precise thread matching.)
 *
 * Payload is parsed defensively because shapes differ across providers — we look
 * for the sender address in the most common fields.
 */
export async function POST(req: Request) {
  const expected = process.env.RESEND_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get("x-webhook-secret");
    if (got !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const data = (body.data ?? body) as Record<string, unknown>;
  const fromEmail = extractFromEmail(data);
  if (!fromEmail) {
    return NextResponse.json({ ok: true, matched: false, reason: "No sender" });
  }

  const headers = (data.headers ?? data.Headers) as
    | Record<string, string | string[] | undefined>
    | undefined;
  const campaignId = parseCampaignIdFromHeaders(headers);

  const result = await recordInboundReply({ fromEmail, campaignId });

  if (result.matched) {
    revalidatePath("/inbox");
    revalidatePath("/pitch-report");
    revalidatePath("/dashboard");
    revalidatePath(`/contacts/${result.contactId}`);
  }

  return NextResponse.json({ ok: true, ...result });
}

/**
 * Pull the sender's email out of a provider payload. Handles:
 *  - Resend: `from` as "Name <addr>" or `{ email }`
 *  - SendGrid Inbound Parse: `from` / `envelope.from`
 *  - Generic: `sender`, `From`
 */
function extractFromEmail(data: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    data.from,
    data.From,
    data.sender,
    data.reply_to,
    (data.envelope as Record<string, unknown> | undefined)?.from,
  ];

  for (const c of candidates) {
    const addr = coerceAddress(c);
    if (addr) return addr;
  }
  return null;
}

function coerceAddress(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.email === "string") return normalizeAddress(obj.email);
    if (typeof obj.address === "string") return normalizeAddress(obj.address);
    return null;
  }
  if (typeof value !== "string") return null;
  return normalizeAddress(value);
}

// "Jane Doe <jane@outlet.com>" → "jane@outlet.com"
function normalizeAddress(raw: string): string | null {
  const angle = raw.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : raw).trim().toLowerCase();
  return /.+@.+\..+/.test(addr) ? addr : null;
}
