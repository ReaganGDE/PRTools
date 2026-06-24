CREATE TABLE "onboarding_paperwork_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"template_url" text,
	"template_file_url" text,
	"template_file_name" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_paperwork" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "onboarding_paperwork_templates" ADD CONSTRAINT "onboarding_paperwork_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_paperwork_templates" ADD CONSTRAINT "onboarding_paperwork_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_paperwork_templates_workspace_idx" ON "onboarding_paperwork_templates" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "onboarding_paperwork" ADD CONSTRAINT "onboarding_paperwork_template_id_onboarding_paperwork_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_paperwork_templates"("id") ON DELETE set null ON UPDATE no action;