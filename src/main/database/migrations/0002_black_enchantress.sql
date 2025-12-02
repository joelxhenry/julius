ALTER TABLE "invoices" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "is_bad_credit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issued_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issued_by_id" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "admin_override_by_id" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "admin_override_notes" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "admin_override_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_id_employees_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_admin_override_by_id_employees_id_fk" FOREIGN KEY ("admin_override_by_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clients_bad_credit" ON "clients" USING btree ("is_bad_credit");--> statement-breakpoint
CREATE INDEX "idx_invoices_issued_by" ON "invoices" USING btree ("issued_by_id");