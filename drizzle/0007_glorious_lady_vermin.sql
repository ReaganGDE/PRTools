CREATE TABLE "influencer_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"tracked_influencer_id" text NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"avg_views" integer DEFAULT 0 NOT NULL,
	"avg_likes" integer DEFAULT 0 NOT NULL,
	"avg_comments" integer DEFAULT 0 NOT NULL,
	"engagement_rate" real DEFAULT 0 NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_influencers" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"handle" text,
	"url" text NOT NULL,
	"thumbnail" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "influencer_snapshots" ADD CONSTRAINT "influencer_snapshots_tracked_influencer_id_tracked_influencers_id_fk" FOREIGN KEY ("tracked_influencer_id") REFERENCES "public"."tracked_influencers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_influencers" ADD CONSTRAINT "tracked_influencers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_influencers" ADD CONSTRAINT "tracked_influencers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "influencer_snapshots_tracked_idx" ON "influencer_snapshots" USING btree ("tracked_influencer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_influencers_ws_ext_uq" ON "tracked_influencers" USING btree ("workspace_id","platform","external_id");