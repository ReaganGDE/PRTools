DO $$ BEGIN
  CREATE TYPE tool_access AS ENUM ('all', 'pr_only', 'social_only');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tool_access" tool_access NOT NULL DEFAULT 'all';
