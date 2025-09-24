CREATE TABLE "landmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "landmark_id" uuid;--> statement-breakpoint
ALTER TABLE "landmarks" ADD CONSTRAINT "landmarks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_landmark_id_landmarks_id_fk" FOREIGN KEY ("landmark_id") REFERENCES "public"."landmarks"("id") ON DELETE set null ON UPDATE no action;