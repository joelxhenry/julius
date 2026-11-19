CREATE TABLE "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(20) NOT NULL,
	"context" varchar(150),
	"user_message" text NOT NULL,
	"technical_message" text NOT NULL,
	"stack" text,
	"error_code" varchar(20),
	"employee_id" integer,
	"employee_name" varchar(120),
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_error_logs_created" ON "error_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_error_logs_resolved" ON "error_logs" USING btree ("resolved");