CREATE TABLE "api_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"period" text NOT NULL,
	"used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "scrapecreators_key" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "scrapecreators_monthly_limit" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_ws_provider_period_uq" ON "api_usage" USING btree ("workspace_id","provider","period");