CREATE TYPE "public"."onboarding_learning_type" AS ENUM('link', 'text');--> statement-breakpoint
CREATE TYPE "public"."onboarding_paperwork_status" AS ENUM('pending', 'submitted', 'approved');--> statement-breakpoint
CREATE TABLE "onboarding_learnings" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "onboarding_learning_type" DEFAULT 'link' NOT NULL,
	"url" text,
	"body" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_paperwork" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"template_url" text,
	"template_file_url" text,
	"template_file_name" text,
	"submitted_file_url" text,
	"submitted_file_name" text,
	"status" "onboarding_paperwork_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"question" text NOT NULL,
	"page_context" text,
	"answered_at" timestamp,
	"emailed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_onboarding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_learnings" ADD CONSTRAINT "onboarding_learnings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_learnings" ADD CONSTRAINT "onboarding_learnings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_paperwork" ADD CONSTRAINT "onboarding_paperwork_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_paperwork" ADD CONSTRAINT "onboarding_paperwork_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_paperwork" ADD CONSTRAINT "onboarding_paperwork_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_questions" ADD CONSTRAINT "onboarding_questions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_questions" ADD CONSTRAINT "onboarding_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_learnings_workspace_idx" ON "onboarding_learnings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "onboarding_paperwork_workspace_idx" ON "onboarding_paperwork" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "onboarding_paperwork_user_idx" ON "onboarding_paperwork" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "onboarding_questions_workspace_idx" ON "onboarding_questions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "onboarding_questions_user_idx" ON "onboarding_questions" USING btree ("user_id");