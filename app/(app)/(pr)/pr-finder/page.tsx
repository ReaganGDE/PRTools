import { requireSession } from "@/lib/auth-helpers";
import { requireSectionAccess } from "@/lib/tool-access";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { movies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { PrFinder } from "./finder";
import { listSavedSearches } from "@/lib/saved-search-actions";

export default async function PrFinderPage() {
  await requireSectionAccess("pr");
  const session = await requireSession();
  const [savedSearches, movieList] = await Promise.all([
    listSavedSearches("pr"),
    db
      .select({ id: movies.id, title: movies.title })
      .from(movies)
      .where(eq(movies.workspaceId, session.workspaceId))
      .orderBy(movies.title),
  ]);

  return (
    <>
      <PageHeader
        title="PR contact finder"
        description="Search your press contacts and discover new journalists writing about a topic."
      />
      <div className="mx-auto max-w-5xl p-8">
        <PrFinder
          newsEnabled={Boolean(env.NEWS_API_KEY)}
          savedSearches={savedSearches}
          movies={movieList}
        />
      </div>
    </>
  );
}
