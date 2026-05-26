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

// Detailed version — returns ok/error so callers can surface API issues.
export async function lookupMoviePoster(
  title: string,
  year?: number | null,
): Promise<TMDBLookupResult> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return { ok: false, error: "TMDB_API_KEY not set" };
  if (!title.trim()) return { ok: true, posterUrl: null, matchedTitle: null };

  try {
    const url = new URL(`${API}/search/movie`);
    url.searchParams.set("api_key", key);
    url.searchParams.set("query", title);
    url.searchParams.set("include_adult", "true");
    if (year) url.searchParams.set("year", String(year));

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

    const target = title.toLowerCase().trim();
    const exact = results.find((r) => r.title?.toLowerCase().trim() === target);
    const pick = exact ?? results[0];
    if (!pick.poster_path)
      return { ok: true, posterUrl: null, matchedTitle: pick.title };
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

