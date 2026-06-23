-- Add discovery sources for the influencer & PR contact finders.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in older
-- Postgres; run each statement on its own. IF NOT EXISTS makes it idempotent.
ALTER TYPE "contact_source" ADD VALUE IF NOT EXISTS 'youtube_discover';
ALTER TYPE "contact_source" ADD VALUE IF NOT EXISTS 'news_discover';
