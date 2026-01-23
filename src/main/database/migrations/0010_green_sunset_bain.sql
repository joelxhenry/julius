ALTER TABLE "suppliers" ADD COLUMN "email1" varchar(200);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "email2" varchar(200);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD COLUMN "supplier_id" integer;--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD CONSTRAINT "inventory_receiving_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_suppliers_active" ON "suppliers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_inv_rec_supplier_id" ON "inventory_receiving" USING btree ("supplier_id");