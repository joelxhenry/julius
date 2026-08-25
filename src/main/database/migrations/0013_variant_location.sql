ALTER TABLE "variants" ADD COLUMN "location" varchar(20);
--> statement-breakpoint
UPDATE "variants" AS v SET "location" = i."location" FROM "inventory" AS i WHERE v."parent_sku" = i."sku" AND v."is_base" = true AND i."location" IS NOT NULL AND v."location" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_variants_location" ON "variants" USING btree ("location");
