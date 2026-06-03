ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "follow_up_days" integer NOT NULL DEFAULT 4;
