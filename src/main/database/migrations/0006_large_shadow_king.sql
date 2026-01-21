CREATE TABLE "inventory_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(50) NOT NULL,
	"is_variant" boolean DEFAULT false NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"thumbnail_path" varchar(500),
	"file_name" varchar(255) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(50),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_inventory_images_sku" ON "inventory_images" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_inventory_images_variant" ON "inventory_images" USING btree ("is_variant");--> statement-breakpoint
CREATE INDEX "idx_inventory_images_primary" ON "inventory_images" USING btree ("sku","is_primary");