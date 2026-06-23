ALTER TYPE "public"."platform" ADD VALUE 'x';--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'linkedin';--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'pinterest';--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'gbp';--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'threads';--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'snapchat';--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'bluesky';--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'multi';--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "media_kind" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "subreddit" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "oneup_category_id" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "oneup_social_network_ids" jsonb;