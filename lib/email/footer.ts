import { env } from "@/lib/env";

const SECRET = () =>
  // Reuse AUTH_SECRET so we don't need another env var; OK because
  // unsubscribe tokens are not auth-critical.
  process.env.AUTH_SECRET ?? "dev-secret";

async function hmac(input: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return Buffer.from(sig).toString("base64url");
}

export async function makeUnsubToken(workspaceId: string, email: string) {
  const payload = `${workspaceId}:${email}`;
  const sig = await hmac(payload);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export async function verifyUnsubToken(
  token: string,
): Promise<{ workspaceId: string; email: string } | null> {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const payload = Buffer.from(payloadB64, "base64url").toString();
  const expected = await hmac(payload);
  if (expected !== sig) return null;
  const [workspaceId, email] = payload.split(":");
  if (!workspaceId || !email) return null;
  return { workspaceId, email };
}

export async function unsubscribeFooter(workspaceId: string, email: string) {
  const token = await makeUnsubToken(workspaceId, email);
  const url = `${env.AUTH_URL}/u/${token}`;
  return `<p style="margin-top:32px;color:#888;font-size:12px;font-family:system-ui,sans-serif">
  You're receiving this because we have you in our outreach list.
  <a href="${url}" style="color:#888">Unsubscribe</a>.
</p>`;
}
