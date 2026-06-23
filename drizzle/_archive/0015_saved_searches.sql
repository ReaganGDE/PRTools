DO $$ BEGIN
  CREATE TYPE saved_search_type AS ENUM ('influencer', 'pr');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "saved_searches" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "type" saved_search_type NOT NULL,
  "name" text NOT NULL,
  "query" text NOT NULL,
  "platforms" text[] DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "saved_searches_workspace_idx" ON "saved_searches" ("workspace_id", "type");
