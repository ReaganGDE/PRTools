import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export type SentimentResult = {
  score: number; // -1 .. 1
  label: "negative" | "neutral" | "positive";
};

const SYSTEM_PROMPT = `You are a sentiment classifier for brand/film mentions.
Given a list of mentions, score each on a scale from -1 (very negative) to 1 (very positive).
0 is neutral. Be calibrated: factual news without praise/criticism is neutral.
Reply with ONLY a JSON array of objects: [{"id":"<id>","score":<number>,"label":"<negative|neutral|positive>"}].
Do not include any other text.`;

export async function scoreMentions(
  items: { id: string; title: string | null; body: string | null }[],
): Promise<Record<string, SentimentResult>> {
  if (items.length === 0) return {};
  if (!process.env.ANTHROPIC_API_KEY) {
    // No key configured — leave unscored.
    return {};
  }

  // Cap each mention's length to keep the prompt small
  const trimmed = items.map((m) => ({
    id: m.id,
    title: (m.title ?? "").slice(0, 200),
    body: (m.body ?? "").slice(0, 500),
  }));

  const userContent = `Score these mentions:\n${JSON.stringify(trimmed)}`;

  const resp = await client().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  // Extract JSON array even if model adds whitespace/preamble
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    return {};
  }
  if (!Array.isArray(parsed)) return {};

  const out: Record<string, SentimentResult> = {};
  for (const row of parsed) {
    if (
      row &&
      typeof row === "object" &&
      "id" in row &&
      "score" in row &&
      "label" in row
    ) {
      const r = row as { id: string; score: number; label: string };
      const score = Math.max(-1, Math.min(1, Number(r.score)));
      const label =
        r.label === "negative" || r.label === "positive"
          ? r.label
          : "neutral";
      out[r.id] = { score, label };
    }
  }
  return out;
}

export function hashUrl(url: string): string {
  // Stable short hash. Not cryptographic — just for dedup.
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h * 31 + url.charCodeAt(i)) | 0;
  }
  return `u_${(h >>> 0).toString(36)}_${url.length.toString(36)}`;
}
