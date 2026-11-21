CREATE TABLE "business_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_date" date NOT NULL,
	"payee" varchar(150) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" varchar(200),
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"payment_method" varchar(50),
	"is_tax_deductible" boolean DEFAULT true NOT NULL,
	"reference_no" varchar(50),
	"authorized_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "categories_type_check";--> statement-breakpoint
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_authorized_by_id_employees_id_fk" FOREIGN KEY ("authorized_by_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_business_expenses_date" ON "business_expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "idx_business_expenses_category" ON "business_expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_business_expenses_deductible" ON "business_expenses" USING btree ("is_tax_deductible");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_type_check" CHECK ("categories"."category_type" IN ('account', 'inventory', 'expense'));