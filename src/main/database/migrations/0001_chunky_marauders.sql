ALTER TABLE "invoices" ADD COLUMN "client_name" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "client_address_1" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "client_address_2" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "client_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "client_email" varchar(100);