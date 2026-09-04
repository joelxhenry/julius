-- Document-number sequences used to generate invoice / quote / credit-note /
-- purchase-order / transfer numbers. These were previously only created by the
-- manual SQL in POSTGRES_SCHEMA.md, so databases set up purely through drizzle
-- migrations were missing them (invoice creation failed with
-- 'relation "seq_invoice_number" does not exist'). Created idempotently so
-- existing installs that already have the sequences (e.g. via legacy import) are
-- left untouched and keep their current values.
CREATE SEQUENCE IF NOT EXISTS seq_invoice_number START WITH 65524;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS seq_credit_note_number START WITH 3658;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS seq_quote_number START WITH 14383;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS seq_purchase_order_number START WITH 1001;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS seq_transfer_number START WITH 6408;
