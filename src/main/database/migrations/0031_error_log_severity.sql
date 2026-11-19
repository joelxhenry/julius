ALTER TABLE "error_logs" ADD COLUMN "severity" varchar(10) DEFAULT 'error' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_error_logs_severity" ON "error_logs" USING btree ("severity");