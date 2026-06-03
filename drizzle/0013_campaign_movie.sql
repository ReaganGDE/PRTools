ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "movie_id" text;
DO $$ BEGIN
  ALTER TABLE "campaigns"
    ADD CONSTRAINT "campaigns_movie_id_movies_id_fk"
    FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "campaigns_movie_idx" ON "campaigns" ("movie_id");
