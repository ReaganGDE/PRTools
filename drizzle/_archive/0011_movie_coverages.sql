CREATE TABLE IF NOT EXISTS "movie_coverages" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "movie_id" text NOT NULL REFERENCES "movies"("id") ON DELETE CASCADE,
  "contact_id" text REFERENCES "contacts"("id") ON DELETE SET NULL,
  "outlet" text,
  "headline" text,
  "url" text,
  "published_at" timestamp,
  "sentiment" sentiment_label,
  "notes" text,
  "added_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "movie_coverages_movie_idx" ON "movie_coverages" ("movie_id");
