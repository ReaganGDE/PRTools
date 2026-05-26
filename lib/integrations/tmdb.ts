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

export async function searchMoviePoster(
  title: string,
  year?: number | null,
): Promise<string | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  if (!title.trim()) return null;

  try {
    const url = new URL(`${API}/search/movie`);
    url.searchParams.set("api_key", key);
    url.searchParams.set("query", title);
    url.searchParams.set("include_adult", "true");
    if (year) url.searchParams.set("year", String(year));

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: TMDBSearchResult[] };
    const results = data.results ?? [];
    if (results.length === 0) return null;

    // Prefer exact title match (case-insensitive), then highest popularity.
    const target = title.toLowerCase().trim();
    const exact = results.find((r) => r.title?.toLowerCase().trim() === target);
    const pick = exact ?? results[0];
    if (!pick.poster_path) return null;
    return `${IMG}${pick.poster_path}`;
  } catch {
    return null;
  }
}
