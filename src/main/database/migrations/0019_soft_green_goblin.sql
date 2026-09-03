CREATE TABLE "product_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(150) NOT NULL,
	"note" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_by_employee_id" integer,
	"created_by_name" varchar(100),
	"ordered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_lists_status_check" CHECK ("product_lists"."status" IN ('open', 'ordered', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "product_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"sku" varchar(50) NOT NULL,
	"is_variant" boolean DEFAULT false NOT NULL,
	"description" varchar(200),
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_list_items_unique" UNIQUE("list_id","sku","is_variant")
);
--> statement-breakpoint
ALTER TABLE "product_list_items" ADD CONSTRAINT "product_list_items_list_id_product_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."product_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_lists" ADD CONSTRAINT "product_lists_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_list_items_list" ON "product_list_items" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "idx_product_list_items_sku" ON "product_list_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_product_lists_status" ON "product_lists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_product_lists_created_by" ON "product_lists" USING btree ("created_by_employee_id");
