ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_wholesale" boolean DEFAULT false NOT NULL;
