CREATE TABLE IF NOT EXISTS "movie_contacts" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "movie_id" text NOT NULL REFERENCES "movies"("id") ON DELETE CASCADE,
  "contact_id" text NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "screener_sent_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "movie_contacts_uniq" ON "movie_contacts" ("movie_id", "contact_id");
CREATE INDEX IF NOT EXISTS "movie_contacts_movie_idx" ON "movie_contacts" ("movie_id");
CREATE INDEX IF NOT EXISTS "movie_contacts_contact_idx" ON "movie_contacts" ("contact_id");
