ALTER TYPE "public"."social_post_status" ADD VALUE 'pending_approval' BEFORE 'scheduled';--> statement-breakpoint
ALTER TYPE "public"."social_post_status" ADD VALUE 'approved' BEFORE 'scheduled';--> statement-breakpoint
ALTER TYPE "public"."social_post_status" ADD VALUE 'rejected' BEFORE 'failed';--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"members_require_approval" boolean DEFAULT false NOT NULL,
	"default_approver_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "requested_approver_id" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "approved_by_id" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_approver_id_users_id_fk" FOREIGN KEY ("default_approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_requested_approver_id_users_id_fk" FOREIGN KEY ("requested_approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;