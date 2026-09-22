ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_in_arrears" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clients_in_arrears" ON "clients" USING btree ("is_in_arrears");
