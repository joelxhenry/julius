ALTER TABLE "inventory_receiving" ADD COLUMN "variant_sku" varchar(50);--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "is_base" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD CONSTRAINT "inventory_receiving_variant_sku_variants_variant_sku_fk" FOREIGN KEY ("variant_sku") REFERENCES "public"."variants"("variant_sku") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inv_rec_variant_sku" ON "inventory_receiving" USING btree ("variant_sku");--> statement-breakpoint
CREATE INDEX "idx_variants_is_base" ON "variants" USING btree ("is_base");