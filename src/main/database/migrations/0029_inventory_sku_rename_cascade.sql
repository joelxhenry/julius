-- Allow renaming an inventory/variant sku: cascade the new value to child rows
-- that reference inventory.sku / variants.variant_sku instead of blocking the
-- update with a FK violation. Needed so archiving a part can free up its sku
-- for reuse by a new part without orphaning stock/receiving history.
ALTER TABLE "variants" DROP CONSTRAINT IF EXISTS "variants_parent_sku_inventory_sku_fk";
--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_parent_sku_inventory_sku_fk" FOREIGN KEY ("parent_sku") REFERENCES "public"."inventory"("sku") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "inventory_categories" DROP CONSTRAINT IF EXISTS "inventory_categories_sku_inventory_sku_fk";
--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_sku_inventory_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."inventory"("sku") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "inventory_markup" DROP CONSTRAINT IF EXISTS "inventory_markup_sku_inventory_sku_fk";
--> statement-breakpoint
ALTER TABLE "inventory_markup" ADD CONSTRAINT "inventory_markup_sku_inventory_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."inventory"("sku") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_sku_inventory_sku_fk";
--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_sku_inventory_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."inventory"("sku") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_variant_sku_variants_variant_sku_fk";
--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_variant_sku_variants_variant_sku_fk" FOREIGN KEY ("variant_sku") REFERENCES "public"."variants"("variant_sku") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "inventory_receiving" DROP CONSTRAINT IF EXISTS "inventory_receiving_sku_inventory_sku_fk";
--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD CONSTRAINT "inventory_receiving_sku_inventory_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."inventory"("sku") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "inventory_receiving" DROP CONSTRAINT IF EXISTS "inventory_receiving_variant_sku_variants_variant_sku_fk";
--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD CONSTRAINT "inventory_receiving_variant_sku_variants_variant_sku_fk" FOREIGN KEY ("variant_sku") REFERENCES "public"."variants"("variant_sku") ON DELETE cascade ON UPDATE cascade;
