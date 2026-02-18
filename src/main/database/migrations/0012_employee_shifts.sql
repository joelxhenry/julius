CREATE TABLE "employee_shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"shift_date" date NOT NULL,
	"clock_in_at" timestamp with time zone NOT NULL,
	"clock_out_at" timestamp with time zone,
	"notes" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_shifts_employee" ON "employee_shifts" USING btree ("employee_id");
--> statement-breakpoint
CREATE INDEX "idx_shifts_date" ON "employee_shifts" USING btree ("shift_date");
--> statement-breakpoint
CREATE INDEX "idx_shifts_employee_date" ON "employee_shifts" USING btree ("employee_id","shift_date");
