ALTER TABLE "quotations" ADD COLUMN "created_by_id" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_id_employees_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quotes_created_by" ON "quotations" USING btree ("created_by_id");