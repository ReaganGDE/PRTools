ALTER TABLE "brands" ADD COLUMN "airtable_table_id" text;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "airtable_last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "logline" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "trailer_url" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "imdb_url" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "director" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "cast_list" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "producer" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "airtable_record_id" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "airtable_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "airtable_token" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "airtable_base_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "movies_airtable_uq" ON "movies" USING btree ("workspace_id","airtable_record_id");