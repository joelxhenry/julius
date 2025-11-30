CREATE TABLE "branches" (
	"branch_code" varchar(5) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(100) NOT NULL,
	"category_type" varchar(20) NOT NULL,
	CONSTRAINT "categories_category_type_unique" UNIQUE("category","category_type"),
	CONSTRAINT "categories_type_check" CHECK ("categories"."category_type" IN ('account', 'inventory'))
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"cl_number" varchar(20),
	"client_name" varchar(100) NOT NULL,
	"contact" varchar(100),
	"address1" varchar(200),
	"address2" varchar(200),
	"phone" varchar(100),
	"notes" text,
	"credit" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit_desc" varchar(200),
	"is_taxable" boolean DEFAULT true NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"credit_limit" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit_terms" varchar(50),
	"custom1" varchar(100),
	"custom2" varchar(100),
	"lb_disc" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company" varchar(100) NOT NULL,
	"address1" varchar(200),
	"address2" varchar(200),
	"address3" varchar(200),
	"phone1" varchar(50),
	"phone2" varchar(50),
	"fax" varchar(50),
	"contact1" varchar(100),
	"contact2" varchar(100),
	"notes" text,
	"credit" numeric(15, 2),
	"credit_desc" varchar(200),
	"is_taxable" boolean,
	"discount_pct" numeric(5, 2),
	"terms" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_company_unique" UNIQUE("company")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"last_name" varchar(50),
	"first_name" varchar(50),
	"title" varchar(50),
	"department" varchar(50),
	"address" text,
	"phone" varchar(50),
	"emergency_contact" varchar(100),
	"start_date" date,
	"end_date" date,
	"status" varchar(20),
	"is_salesperson" boolean DEFAULT false NOT NULL,
	"commission" numeric(10, 2),
	"username" varchar(50),
	"password_hash" varchar(255),
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"access_codes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_code_unique" UNIQUE("code"),
	CONSTRAINT "employees_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(50) NOT NULL,
	"location" varchar(20),
	"description1" varchar(200),
	"description2" varchar(200),
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_level" integer DEFAULT 0 NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"cost_currency" varchar(10) DEFAULT 'JA' NOT NULL,
	"price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"price_currency" varchar(10) DEFAULT 'JA' NOT NULL,
	"margin" numeric(8, 4),
	"unit" varchar(10) DEFAULT 'EA' NOT NULL,
	"category" varchar(100),
	"model" varchar(200),
	"wholesale_price" numeric(15, 2),
	"icheck" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "inventory_alternates" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_no" varchar(50) NOT NULL,
	"alternate_no" varchar(50) NOT NULL,
	"supplier" varchar(100),
	CONSTRAINT "inv_alt_unique" UNIQUE("part_no","alternate_no")
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(50) NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "inv_cat_unique" UNIQUE("sku","category_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_markup" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(50),
	"sku" varchar(50),
	"description" varchar(200),
	"retail_price" numeric(15, 2),
	"quantity" integer
);
--> statement-breakpoint
CREATE TABLE "inventory_receiving" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(50) NOT NULL,
	"supplier" varchar(100),
	"receiving_date" date,
	"quantity" integer,
	"last_cost" numeric(15, 2),
	"last_cost_currency" varchar(10),
	"prior_cost" numeric(15, 2),
	"prior_cost_currency" varchar(10),
	"last_price" numeric(15, 2),
	"last_price_currency" varchar(10),
	"last_wholesale_price" numeric(15, 2),
	"reference" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(50) NOT NULL,
	"activity" varchar(20) NOT NULL,
	"reference" varchar(50),
	"quantity" integer NOT NULL,
	"activity_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_sku" varchar(50) NOT NULL,
	"variant_sku" varchar(50) NOT NULL,
	"variant_name" varchar(100),
	"variant_type" varchar(50),
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" varchar(200),
	"quantity" integer DEFAULT 0 NOT NULL,
	"cost" numeric(15, 2),
	"cost_currency" varchar(10) DEFAULT 'JA' NOT NULL,
	"price" numeric(15, 2),
	"price_currency" varchar(10) DEFAULT 'JA' NOT NULL,
	"wholesale_price" numeric(15, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "variants_variant_sku_unique" UNIQUE("variant_sku")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"inv_number" varchar(20) NOT NULL,
	"inv_date" date NOT NULL,
	"inv_time" integer,
	"salesperson_id" integer,
	"client_id" integer,
	"client_name" varchar(100),
	"client_address1" varchar(200),
	"client_address2" varchar(200),
	"client_phone" varchar(100),
	"reference" varchar(100),
	"sub_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"status" varchar(10) DEFAULT 'A' NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"pricing" varchar(10) DEFAULT 'R' NOT NULL,
	"credit_terms" varchar(50),
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_inv_number_unique" UNIQUE("inv_number")
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_num" varchar(20) NOT NULL,
	"quote_date" date NOT NULL,
	"salesperson_id" integer,
	"client_id" integer,
	"client_name" varchar(100),
	"client_address1" varchar(200),
	"client_address2" varchar(200),
	"client_phone" varchar(100),
	"reference" varchar(100),
	"sub_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"pricing" varchar(10) DEFAULT 'R' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quote_num_unique" UNIQUE("quote_num")
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cr_number" varchar(20) NOT NULL,
	"inv_number" varchar(20),
	"cr_date" date NOT NULL,
	"salesperson_id" integer,
	"client_id" integer,
	"client_name" varchar(100),
	"client_address1" varchar(200),
	"client_address2" varchar(200),
	"client_phone" varchar(100),
	"reference" varchar(100),
	"sub_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_used" numeric(15, 2) DEFAULT '0' NOT NULL,
	"status" varchar(10) DEFAULT 'A' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_cr_number_unique" UNIQUE("cr_number")
);
--> statement-breakpoint
CREATE TABLE "document_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_type" varchar(10) NOT NULL,
	"document_number" varchar(20) NOT NULL,
	"line_number" integer NOT NULL,
	"sku" varchar(50),
	"description" varchar(200),
	"quantity" numeric(15, 4) DEFAULT '0' NOT NULL,
	"unit_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "doc_items_unique" UNIQUE("document_type","document_number","line_number"),
	CONSTRAINT "doc_items_type_check" CHECK ("document_line_items"."document_type" IN ('INVOICE', 'QUOTE', 'CREDIT'))
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "payment_methods_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_type" varchar(10) NOT NULL,
	"document_number" varchar(50) NOT NULL,
	"invoice_number" varchar(20),
	"credit_note_number" varchar(20),
	"bill_number" varchar(50),
	"payer_name" varchar(100),
	"payment_date" date,
	"payment_desc" varchar(100),
	"payment_desc2" varchar(100),
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_type_check" CHECK ("payments"."document_type" IN ('INVOICE', 'CREDIT', 'BILL'))
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_no" varchar(50) NOT NULL,
	"supplier" varchar(100),
	"bill_date" date,
	"order_no" varchar(50),
	"description" varchar(200),
	"category" varchar(100),
	"sub_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"bill_currency" varchar(10),
	"total_paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"pay_date" date,
	"ordered_by" varchar(50),
	"status" varchar(10) DEFAULT 'A' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bills_bill_no_unique" UNIQUE("bill_no")
);
--> statement-breakpoint
CREATE TABLE "employee_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"last_name" varchar(50),
	"first_name" varchar(50),
	"department" varchar(50),
	"log_date" date NOT NULL,
	"log_type" varchar(10) NOT NULL,
	"in_time_1" integer,
	"out_time_1" integer,
	"in_time_2" integer,
	"out_time_2" integer,
	"in_time_3" integer,
	"out_time_3" integer,
	"activity" varchar(10),
	"activity_time" integer,
	"activity_desc" varchar(50),
	CONSTRAINT "attendance_type_check" CHECK ("employee_attendance"."log_type" IN ('DAILY', 'EVENT'))
);
--> statement-breakpoint
CREATE TABLE "gct_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" integer,
	"year" integer,
	"deduction" numeric(15, 2),
	"amount" numeric(15, 2),
	CONSTRAINT "gct_payments_month_year" UNIQUE("month","year")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"group" varchar(100) NOT NULL,
	"description" text,
	"readonly" boolean DEFAULT false NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_sku_inventory_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."inventory"("sku") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_markup" ADD CONSTRAINT "inventory_markup_sku_inventory_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."inventory"("sku") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD CONSTRAINT "inventory_receiving_sku_inventory_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."inventory"("sku") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD CONSTRAINT "inventory_receiving_supplier_suppliers_company_fk" FOREIGN KEY ("supplier") REFERENCES "public"."suppliers"("company") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_sku_inventory_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."inventory"("sku") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_parent_sku_inventory_sku_fk" FOREIGN KEY ("parent_sku") REFERENCES "public"."inventory"("sku") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_salesperson_id_employees_id_fk" FOREIGN KEY ("salesperson_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_salesperson_id_employees_id_fk" FOREIGN KEY ("salesperson_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_inv_number_invoices_inv_number_fk" FOREIGN KEY ("inv_number") REFERENCES "public"."invoices"("inv_number") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_salesperson_id_employees_id_fk" FOREIGN KEY ("salesperson_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_line_items" ADD CONSTRAINT "document_line_items_sku_inventory_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."inventory"("sku") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_number_invoices_inv_number_fk" FOREIGN KEY ("invoice_number") REFERENCES "public"."invoices"("inv_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_credit_note_number_credit_notes_cr_number_fk" FOREIGN KEY ("credit_note_number") REFERENCES "public"."credit_notes"("cr_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_number_bills_bill_no_fk" FOREIGN KEY ("bill_number") REFERENCES "public"."bills"("bill_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_supplier_suppliers_company_fk" FOREIGN KEY ("supplier") REFERENCES "public"."suppliers"("company") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_attendance" ADD CONSTRAINT "employee_attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_categories_type" ON "categories" USING btree ("category_type");--> statement-breakpoint
CREATE INDEX "idx_clients_name" ON "clients" USING btree ("client_name");--> statement-breakpoint
CREATE INDEX "idx_clients_cl_number" ON "clients" USING btree ("cl_number");--> statement-breakpoint
CREATE INDEX "idx_suppliers_company" ON "suppliers" USING btree ("company");--> statement-breakpoint
CREATE INDEX "idx_employees_code" ON "employees" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_employees_name" ON "employees" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "idx_employees_salesperson" ON "employees" USING btree ("is_salesperson");--> statement-breakpoint
CREATE INDEX "idx_employees_username" ON "employees" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_inventory_sku" ON "inventory" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_inventory_category" ON "inventory" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_inventory_location" ON "inventory" USING btree ("location");--> statement-breakpoint
CREATE INDEX "idx_inv_alt_partno" ON "inventory_alternates" USING btree ("part_no");--> statement-breakpoint
CREATE INDEX "idx_inv_alt_altno" ON "inventory_alternates" USING btree ("alternate_no");--> statement-breakpoint
CREATE INDEX "idx_inv_cat_sku" ON "inventory_categories" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_inv_cat_category_id" ON "inventory_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_inv_markup_sku" ON "inventory_markup" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_inv_rec_sku" ON "inventory_receiving" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_inv_rec_supplier" ON "inventory_receiving" USING btree ("supplier");--> statement-breakpoint
CREATE INDEX "idx_inv_trans_sku" ON "inventory_transactions" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_inv_trans_date" ON "inventory_transactions" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "idx_inv_trans_reference" ON "inventory_transactions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_variants_parent_sku" ON "variants" USING btree ("parent_sku");--> statement-breakpoint
CREATE INDEX "idx_variants_variant_sku" ON "variants" USING btree ("variant_sku");--> statement-breakpoint
CREATE INDEX "idx_variants_type" ON "variants" USING btree ("variant_type");--> statement-breakpoint
CREATE INDEX "idx_variants_active" ON "variants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_invoices_number" ON "invoices" USING btree ("inv_number");--> statement-breakpoint
CREATE INDEX "idx_invoices_date" ON "invoices" USING btree ("inv_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_client" ON "invoices" USING btree ("client_name");--> statement-breakpoint
CREATE INDEX "idx_invoices_client_id" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_salesperson" ON "invoices" USING btree ("salesperson_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_archived" ON "invoices" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "idx_quotes_number" ON "quotations" USING btree ("quote_num");--> statement-breakpoint
CREATE INDEX "idx_quotes_date" ON "quotations" USING btree ("quote_date");--> statement-breakpoint
CREATE INDEX "idx_quotes_client" ON "quotations" USING btree ("client_name");--> statement-breakpoint
CREATE INDEX "idx_quotes_client_id" ON "quotations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_archived" ON "quotations" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "idx_crnotes_number" ON "credit_notes" USING btree ("cr_number");--> statement-breakpoint
CREATE INDEX "idx_crnotes_inv" ON "credit_notes" USING btree ("inv_number");--> statement-breakpoint
CREATE INDEX "idx_crnotes_date" ON "credit_notes" USING btree ("cr_date");--> statement-breakpoint
CREATE INDEX "idx_crnotes_client" ON "credit_notes" USING btree ("client_name");--> statement-breakpoint
CREATE INDEX "idx_crnotes_client_id" ON "credit_notes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_crnotes_archived" ON "credit_notes" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "idx_doc_items_type_number" ON "document_line_items" USING btree ("document_type","document_number");--> statement-breakpoint
CREATE INDEX "idx_doc_items_sku" ON "document_line_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_payments_type_number" ON "payments" USING btree ("document_type","document_number");--> statement-breakpoint
CREATE INDEX "idx_payments_date" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_payments_invoice" ON "payments" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "idx_payments_credit" ON "payments" USING btree ("credit_note_number");--> statement-breakpoint
CREATE INDEX "idx_payments_bill" ON "payments" USING btree ("bill_number");--> statement-breakpoint
CREATE INDEX "idx_bills_number" ON "bills" USING btree ("bill_no");--> statement-breakpoint
CREATE INDEX "idx_bills_supplier" ON "bills" USING btree ("supplier");--> statement-breakpoint
CREATE INDEX "idx_bills_date" ON "bills" USING btree ("bill_date");--> statement-breakpoint
CREATE INDEX "idx_attendance_date" ON "employee_attendance" USING btree ("log_date");--> statement-breakpoint
CREATE INDEX "idx_attendance_employee" ON "employee_attendance" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_type" ON "employee_attendance" USING btree ("log_type");--> statement-breakpoint
CREATE INDEX "idx_attendance_name" ON "employee_attendance" USING btree ("last_name","first_name");