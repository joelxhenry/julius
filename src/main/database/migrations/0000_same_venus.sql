CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_id` integer,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address1` text,
	`address2` text,
	`credit_limit` real DEFAULT 0 NOT NULL,
	`discount_rate` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_legacy_id_unique` ON `clients` (`legacy_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `clients_email_unique` ON `clients` (`email`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`username` text NOT NULL,
	`title` text,
	`using_default_pin` integer DEFAULT true NOT NULL,
	`pin_hash` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`role_id` integer,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_username_unique` ON `employees` (`username`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_id` integer NOT NULL,
	`permission_id` integer NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `part_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`part_id` integer NOT NULL,
	`name` text,
	`description` text,
	`is_generic` integer DEFAULT false NOT NULL,
	`price` real NOT NULL,
	`stock_qty` integer DEFAULT 0 NOT NULL,
	`reorder_level` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`barcode` text,
	`location` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `part_variants_barcode_unique` ON `part_variants` (`barcode`);--> statement-breakpoint
CREATE TABLE `parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`sku` text NOT NULL,
	`price` real NOT NULL,
	`taxable` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parts_sku_unique` ON `parts` (`sku`);--> statement-breakpoint
CREATE TABLE `part_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`part_id` integer NOT NULL,
	`vehicle_model_id` integer NOT NULL,
	`year_start` text,
	`year_end` text,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_model_id`) REFERENCES `vehicle_models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vehicle_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quotation_id` integer NOT NULL,
	`variant_id` integer,
	`quantity` integer NOT NULL,
	`price` real NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `part_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer,
	`employee_id` integer,
	`total` real NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_id` integer,
	`invoice_id` integer NOT NULL,
	`variant_id` integer,
	`quantity` integer NOT NULL,
	`price` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`tax` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `part_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_items_legacy_id_unique` ON `invoice_items` (`legacy_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_id` integer,
	`client_id` integer,
	`employee_id` integer,
	`status` text NOT NULL,
	`subtotal` real NOT NULL,
	`tax_total` real NOT NULL,
	`discount_total` real NOT NULL,
	`total` real NOT NULL,
	`amount_paid` real DEFAULT 0 NOT NULL,
	`balance` real NOT NULL,
	`is_historical` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_legacy_id_unique` ON `invoices` (`legacy_id`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_methods_code_unique` ON `payment_methods` (`code`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_id` integer,
	`invoice_id` integer NOT NULL,
	`employee_id` integer,
	`payment_method_id` integer NOT NULL,
	`amount` real NOT NULL,
	`paid_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_legacy_id_unique` ON `payments` (`legacy_id`);--> statement-breakpoint
CREATE TABLE `credit_note_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`credit_note_id` integer NOT NULL,
	`invoice_id` integer NOT NULL,
	`amount_applied` real NOT NULL,
	`applied_at` text NOT NULL,
	`employee_id` integer,
	FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `credit_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`invoice_id` integer,
	`employee_id` integer,
	`amount` real NOT NULL,
	`remaining_amount` real NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`group` text NOT NULL,
	`description` text,
	`readonly` integer DEFAULT false NOT NULL,
	`visible` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_settings_key_unique` ON `system_settings` (`key`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer,
	`action` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
