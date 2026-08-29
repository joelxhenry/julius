CREATE TABLE "goods_receivals" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(50),
	"supplier_id" integer,
	"supplier" varchar(100),
	"receiving_date" date,
	"status" varchar(20) DEFAULT 'posted' NOT NULL,
	"notes" text,
	"line_count" integer DEFAULT 0 NOT NULL,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"total_cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD COLUMN "receival_id" integer;--> statement-breakpoint
ALTER TABLE "goods_receivals" ADD CONSTRAINT "goods_receivals_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_goods_rec_reference" ON "goods_receivals" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_goods_rec_supplier_id" ON "goods_receivals" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_goods_rec_date" ON "goods_receivals" USING btree ("receiving_date");--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD CONSTRAINT "inventory_receiving_receival_id_goods_receivals_id_fk" FOREIGN KEY ("receival_id") REFERENCES "public"."goods_receivals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inv_rec_receival_id" ON "inventory_receiving" USING btree ("receival_id");
