CREATE TYPE "public"."resource_type" AS ENUM('link', 'credential', 'document');--> statement-breakpoint
CREATE TABLE "resource_groups" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "color" text DEFAULT '#6366f1' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "resource_groups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
);--> statement-breakpoint
CREATE TABLE "resource_group_members" (
  "group_id" text NOT NULL,
  "user_id" text NOT NULL,
  "added_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "resource_group_members_pkey" PRIMARY KEY ("group_id","user_id"),
  CONSTRAINT "resource_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "resource_groups"("id") ON DELETE CASCADE,
  CONSTRAINT "resource_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);--> statement-breakpoint
CREATE TABLE "resources" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "type" "resource_type" NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "url" text,
  "username" text,
  "password" text,
  "file_url" text,
  "file_name" text,
  "file_size" integer,
  "file_mime_type" text,
  "external_url" text,
  "is_personal" boolean DEFAULT false NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "resources_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
);--> statement-breakpoint
CREATE TABLE "resource_group_assignments" (
  "resource_id" text NOT NULL,
  "group_id" text NOT NULL,
  CONSTRAINT "resource_group_assignments_pkey" PRIMARY KEY ("resource_id","group_id"),
  CONSTRAINT "resource_group_assignments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE,
  CONSTRAINT "resource_group_assignments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "resource_groups"("id") ON DELETE CASCADE
);--> statement-breakpoint
CREATE TABLE "resource_user_assignments" (
  "resource_id" text NOT NULL,
  "user_id" text NOT NULL,
  CONSTRAINT "resource_user_assignments_pkey" PRIMARY KEY ("resource_id","user_id"),
  CONSTRAINT "resource_user_assignments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE,
  CONSTRAINT "resource_user_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);--> statement-breakpoint
CREATE INDEX "resource_groups_workspace_idx" ON "resource_groups"("workspace_id");--> statement-breakpoint
CREATE INDEX "resources_workspace_idx" ON "resources"("workspace_id");--> statement-breakpoint
CREATE INDEX "resources_created_by_idx" ON "resources"("created_by");
