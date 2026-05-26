ALTER TABLE "movies" ADD COLUMN IF NOT EXISTS "poster_airtable_url" text;
-- Migrate existing posterUrl values to poster_airtable_url where they look
-- like Airtable signed URLs (contain "airtable.com" or "dl.airtable.com").
UPDATE movies
SET poster_airtable_url = poster_url
WHERE poster_url ILIKE '%airtable.com%'
  AND poster_airtable_url IS NULL;
