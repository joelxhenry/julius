ALTER TABLE "payments" ADD COLUMN "processed_by_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_processed_by_id_employees_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payments_processed_by" ON "payments" USING btree ("processed_by_id");