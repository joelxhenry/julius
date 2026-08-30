-- Allow renaming a supplier's company: cascade the new name to child rows that
-- reference suppliers.company instead of blocking the update with a FK violation.
ALTER TABLE "inventory_receiving" DROP CONSTRAINT IF EXISTS "inventory_receiving_supplier_suppliers_company_fk";
--> statement-breakpoint
ALTER TABLE "inventory_receiving" ADD CONSTRAINT "inventory_receiving_supplier_suppliers_company_fk" FOREIGN KEY ("supplier") REFERENCES "public"."suppliers"("company") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "bills" DROP CONSTRAINT IF EXISTS "bills_supplier_suppliers_company_fk";
--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_supplier_suppliers_company_fk" FOREIGN KEY ("supplier") REFERENCES "public"."suppliers"("company") ON DELETE set null ON UPDATE cascade;
