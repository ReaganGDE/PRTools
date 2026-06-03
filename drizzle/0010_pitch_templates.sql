CREATE TABLE IF NOT EXISTS "pitch_templates" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "pitch_templates_workspace_idx" ON "pitch_templates" ("workspace_id");
