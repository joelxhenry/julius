CREATE TABLE "access_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"permission_code" varchar(80) NOT NULL,
	"action_label" varchar(160),
	"requested_by_id" integer,
	"requested_by_name" varchar(120),
	"granted_by_id" integer,
	"granted_by_name" varchar(120),
	"context" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_overrides" ADD CONSTRAINT "access_overrides_requested_by_id_employees_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "access_overrides" ADD CONSTRAINT "access_overrides_granted_by_id_employees_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_access_overrides_permission" ON "access_overrides" USING btree ("permission_code");
--> statement-breakpoint
CREATE INDEX "idx_access_overrides_requested_by" ON "access_overrides" USING btree ("requested_by_id");
--> statement-breakpoint
CREATE INDEX "idx_access_overrides_granted_by" ON "access_overrides" USING btree ("granted_by_id");
--> statement-breakpoint
CREATE INDEX "idx_access_overrides_created" ON "access_overrides" USING btree ("created_at");
