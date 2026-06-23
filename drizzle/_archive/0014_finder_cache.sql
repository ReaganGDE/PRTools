CREATE TABLE IF NOT EXISTS "finder_cache" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "cache_key" text NOT NULL,
  "results" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "finder_cache_key_idx" ON "finder_cache" ("workspace_id", "cache_key");
CREATE INDEX IF NOT EXISTS "finder_cache_expires_idx" ON "finder_cache" ("expires_at");
