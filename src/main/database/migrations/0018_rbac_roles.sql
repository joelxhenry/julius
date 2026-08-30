-- RBAC: roles table + employee role assignment.
CREATE TABLE IF NOT EXISTS "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(60) NOT NULL,
	"description" varchar(200),
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_roles_name" ON "roles" USING btree ("name");
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "role_id" integer;
--> statement-breakpoint
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_role_id_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_role" ON "employees" USING btree ("role_id");
--> statement-breakpoint
-- Seed a protected super-admin role so full access always exists.
INSERT INTO "roles" ("name", "description", "permissions", "is_super_admin", "is_system")
VALUES ('Administrator', 'Full access to every feature', '{"ADMIN": true}'::jsonb, true, true)
ON CONFLICT ("name") DO NOTHING;
