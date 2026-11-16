ALTER TABLE "inventory" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_inventory_active" ON "inventory" USING btree ("is_active");