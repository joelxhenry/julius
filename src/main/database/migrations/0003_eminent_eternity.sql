ALTER TABLE "document_line_items" DROP CONSTRAINT "document_line_items_sku_inventory_sku_fk";
--> statement-breakpoint
ALTER TABLE "document_line_items" ADD COLUMN "is_variant" boolean DEFAULT false NOT NULL;