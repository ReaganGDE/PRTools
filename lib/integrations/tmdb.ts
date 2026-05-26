// TMDB poster lookup. Requires TMDB_API_KEY env var (free from
// themoviedb.org/settings/api). Returns the best-match poster URL or null.

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

type TMDBSearchResult = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  popularity?: number;
};

export type TMDBLookupResult =
  | { ok: true; posterUrl: string | null; matchedTitle: string | null }
  | { ok: false; error: string };

// Strip parenthetical suffixes like " (Netflix 3/26 launch)" before searching.
function cleanTitleForSearch(title: string): string {
  return title.replace(/\s*\(.*?\)\s*/g, " ").trim();
}

// Fraction of search-title words that appear in the candidate title.
// Returns 1.0 for an exact normalized match, 0.0 for completely unrelated.
function titleWordCoverage(searchTitle: string, candidateTitle: string): number {
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
  const sw = words(searchTitle);
  const cw = new Set(words(candidateTitle));
  if (sw.length === 0) return 0;
  const matches = sw.filter((w) => cw.has(w)).length;
  return matches / sw.length;
}

// Detailed version — returns ok/error so callers can surface API issues.
export async function lookupMoviePoster(
  title: string,
  year?: number | null,
): Promise<TMDBLookupResult> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return { ok: false, error: "TMDB_API_KEY not set" };
  if (!title.trim()) return { ok: true, posterUrl: null, matchedTitle: null };

  // Strip parentheticals so "Caterpillar (Netflix 3/26 launch)" → "Caterpillar"
  const searchTitle = cleanTitleForSearch(title);

  try {
    const url = new URL(`${API}/search/movie`);
    url.searchParams.set("api_key", key);
    url.searchParams.set("query", searchTitle);
    url.searchParams.set("include_adult", "true");
    // Don't filter by year — TMDB indexes by theatrical year and we have TVOD year,
    // which often differs. We use year below as a soft tiebreaker instead.

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // TMDB returns JSON errors like {"status_code":7,"status_message":"Invalid API key..."}
      let message = `TMDB ${res.status}`;
      try {
        const parsed = JSON.parse(body) as { status_message?: string };
        if (parsed.status_message) message += `: ${parsed.status_message}`;
      } catch {
        if (body) message += `: ${body.slice(0, 200)}`;
      }
      return { ok: false, error: message };
    }

    const data = (await res.json()) as { results?: TMDBSearchResult[] };
    const results = data.results ?? [];
    if (results.length === 0)
      return { ok: true, posterUrl: null, matchedTitle: null };

    const target = searchTitle.toLowerCase().trim();
    const targetYear = year ?? null;
    // Score: exact title match (+10), year match (+5), popularity (raw).
    // Only keep results with a poster AND sufficient title word overlap.
    // Requiring >= 60% of the search words to appear in the candidate title
    // prevents false matches like "Caterpillar" → Dutch film "Rups".
    const MIN_COVERAGE = 0.6;
    const scored = results
      .map((r) => {
        const rTitle = r.title ?? "";
        const exact = rTitle.toLowerCase().trim() === target ? 10 : 0;
        const yearOf = r.release_date
          ? parseInt(r.release_date.slice(0, 4), 10)
          : null;
        const yearMatch =
          targetYear && yearOf && Math.abs(yearOf - targetYear) <= 1 ? 5 : 0;
        const pop = r.popularity ?? 0;
        const coverage = titleWordCoverage(searchTitle, rTitle);
        return { r, score: exact + yearMatch + pop, coverage };
      })
      .filter((s) => s.r.poster_path && s.coverage >= MIN_COVERAGE)
      .sort((a, b) => b.score - a.score);

    const pick = scored[0]?.r;
    if (!pick?.poster_path)
      return { ok: true, posterUrl: null, matchedTitle: null };
    return {
      ok: true,
      posterUrl: `${IMG}${pick.poster_path}`,
      matchedTitle: pick.title,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Convenience wrapper used by the Airtable sync — returns null on any error.
export async function searchMoviePoster(
  title: string,
  year?: number | null,
): Promise<string | null> {
  const r = await lookupMoviePoster(title, year);
  return r.ok ? r.posterUrl : null;
}

