CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"employee_name" varchar(120),
	"username" varchar(50),
	"login_at" timestamp DEFAULT now() NOT NULL,
	"logout_at" timestamp,
	"logout_reason" varchar(20)
);
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_sessions_employee" ON "user_sessions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_login" ON "user_sessions" USING btree ("login_at");
