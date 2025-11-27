# Auto Parts Management System (Electron + React + PostgreSQL)  
**Functional Requirements & Data Spec for Claude AI**

This document describes a modern replacement for a legacy DOS-based auto parts system (“Turbo / Julius”).  
The database schema is based on the existing design (originally SQLite) but will be implemented in **PostgreSQL**.

---

## 1. PROJECT OVERVIEW

We are building a **desktop** auto parts management application with:

- **Electron** as the desktop shell
- **React** for UI
- **Mantine** components + **Tailwind CSS** for styling
- **PostgreSQL** as the main database (single instance, LAN-accessible)
- Data model based on existing `turbo-julius` schema (tables like `parts`, `part_variants`, `clients`, `invoices`, `payments`, etc.)

Primary goals:

- Preserve the **speed and efficiency** of the legacy DOS system
- Provide a **modern UI** with keyboard-first workflows
- Support **multi-terminal** usage via shared PostgreSQL DB
- Maintain compatibility concepts (legacy IDs, credit notes, quotations, etc.)

---

## 2. USER ROLES & ACCESS CONTROL

### 2.1 Roles (from `roles` table)

- Backed by table: `roles`
- Columns:
  - `id` (PK)
  - `name` – role name (e.g. "Admin", "Manager", "Cashier", etc.)

### 2.2 Permissions (from `permissions` & `role_permissions`)

- Table: `permissions`
  - `id` (PK)
  - `code` – internal permission code (e.g. `INVOICE_CREATE`, `PAYMENT_REFUND`)
  - `description` – human-readable description

- Table: `role_permissions`
  - `id` (PK)
  - `role_id` (FK → `roles.id`)
  - `permission_id` (FK → `permissions.id`)

The app should enforce role/permission checks for sensitive actions like:

- Voiding invoices
- Changing system settings
- Adjusting stock
- Creating credit notes
- Applying large discounts

---

## 3. CORE MODULES & TABLES

Below are the functional requirements, connected directly to the **actual DB tables and columns**.

---

## 3.1 Inventory & Parts

### 3.1.1 Parts (`parts`)

Represents the main parts catalog.

- Table: `parts`
- Columns:
  - `id` (PK, integer)
  - `name` – part name
  - `category` – category label (brakes, suspension, etc.)
  - `description` – detailed description
  - `sku` – unique stock keeping unit (UNIQUE)
  - `price` – base price
  - `taxable` – boolean (int -> bool)
  - `created_at` – timestamp

**Functional requirements:**

- Create/edit/delete parts (soft delete later if needed).
- Enforce unique `sku`.
- Support search by:
  - `sku`
  - `name`
  - `category`
- Show whether the part is taxable.

### 3.1.2 Part Variants (`part_variants`)

Represents specific sellable variants and stock.

- Table: `part_variants`
- Columns:
  - `id` (PK)
  - `part_id` (FK → `parts.id`)
  - `name` – variant name ("LEFT", "RIGHT", brand, size, etc.)
  - `description`
  - `is_generic` – boolean
  - `price` – variant price (override base price)
  - `stock_qty` – current stock
  - `reorder_level` – low-stock threshold
  - `active` – boolean
  - `barcode` – optional, UNIQUE
  - `location` – location code (e.g. “A1-B3”)
  - `created_at` – timestamp

**Functional requirements:**

- Maintain stock per variant (`stock_qty`).
- Show low-stock based on `reorder_level`.
- Allow variant-level active/inactive.
- Search by `barcode`, `name`, `location`.
- Adjust stock (with PIN + audit log).

### 3.1.3 Vehicle Models & Compatibility

Used for chassis/model lookup.

- `vehicle_models`
  - `id`
  - `make`
  - `model`

- `part_models`
  - `id`
  - `part_id` (FK → `parts.id`)
  - `vehicle_model_id` (FK → `vehicle_models.id`)
  - `year_start`
  - `year_end`

**Functional requirements:**

- Link parts to compatible `vehicle_models` via `part_models`.
- Support quick lookup:
  - by vehicle make/model + year range
- Use for search screens and possibly a “compatible vehicles” sidebar.

---

## 3.2 Clients & Credit

### 3.2.1 Clients (`clients`)

- Table: `clients`
- Columns:
  - `id` (PK)
  - `legacy_id` – legacy client id (UNIQUE)
  - `name`
  - `phone`
  - `email` (UNIQUE, nullable)
  - `address1`
  - `address2`
  - `credit_limit` – credit limit amount
  - `discount_rate` – default discount % for the client
  - `created_at` – timestamp

**Functional requirements:**

- Manage clients (create/edit/deactivate).
- Use `legacy_id` for migration / cross-reference.
- Display credit info:
  - `credit_limit`
  - outstanding balance (calculated from invoices/payments/credit notes).
- Autoload:
  - `discount_rate` on new invoices.
- Quickly view:
  - invoice history
  - payment history
  - credit notes

---

## 3.3 Employees & PINs

### 3.3.1 Employees (`employees`)

- Table: `employees`
- Columns:
  - `id`
  - `first_name`
  - `last_name`
  - `username` (UNIQUE)
  - `title`
  - `using_default_pin` – boolean
  - `pin_hash` – hashed PIN
  - `start_date`
  - `end_date` – nullable, for inactive/terminated employees
  - `role_id` (FK → `roles.id`)

**Functional requirements:**

- Login/identify employees via `username` + `PIN`.
- Enforce PIN change if `using_default_pin` is true.
- Tie key actions (invoices, payments, credit notes, adjustments) to `employee_id`.
- Show name and title in UI (e.g. header, receipts).

### 3.3.2 PIN-Protected Actions

- PIN verification required for:
  - Large discounts
  - Invoice void/cancel
  - Stock adjustments
  - Credit notes
  - System settings changes
- Use `audit_logs` to store who did what.

---

## 3.4 Invoices & Invoice Items

### 3.4.1 Invoices (`invoices`)

- Table: `invoices`
- Columns:
  - `id`
  - `legacy_id` – DBF invoice number (UNIQUE, nullable)
  - `client_id` (FK → `clients.id`, nullable)
  - `employee_id` (FK → `employees.id`, nullable)
  - `status` – e.g. DRAFT, ISSUED, PARTIAL, PAID, CANCELLED
  - `subtotal` – before tax/discount
  - `tax_total`
  - `discount_total`
  - `total` – final total
  - `amount_paid` – total of payments
  - `balance` – remaining amount
  - `created_at`

**Functional requirements:**

- Create invoice:
  - Attach client (optional for walk-in if allowed).
  - Auto-calc totals.
  - Status defaults to `DRAFT` or `ISSUED` depending on flow.
- Attach `employee_id` of the user who created the invoice.
- Enforce:
  - `amount_paid` + `balance` = `total`
- Status transitions:
  - DRAFT → ISSUED → PARTIAL/PAID/CANCELLED
- Display:
  - list view filterable by `status`, date, `client`, `legacy_id`, etc.

### 3.4.2 Invoice Items (`invoice_items`)

- Table: `invoice_items`
- Columns:
  - `id`
  - `legacy_id` – legacy line id (UNIQUE, nullable)
  - `invoice_id` (FK → `invoices.id`)
  - `variant_id` (FK → `part_variants.id`, nullable)
  - `quantity`
  - `price` – unit price
  - `discount`
  - `tax`

**Functional requirements:**

- Add multiple line items to invoice.
- Each line references a `part_variant` if available.
- `price`, `discount`, `tax` used to compute:
  - line totals
  - invoice totals.
- Support editing line items while invoice is in allowed status (e.g. DRAFT/ISSUED with permissions).

---

## 3.5 Quotations

### 3.5.1 Quotations (`quotations` & `quotation_items`)

- `quotations`
  - `id`
  - `client_id` (FK → `clients.id`, nullable)
  - `employee_id` (FK → `employees.id`, nullable)
  - `total`
  - `status`
  - `created_at`

- `quotation_items`
  - `id`
  - `quotation_id` (FK → `quotations.id`)
  - `variant_id` (FK → `part_variants.id`, nullable)
  - `quantity`
  - `price`

**Functional requirements:**

- Create sales quotations separate from invoices.
- Convert quotation → invoice (re-using `quotation_items` into `invoice_items`).
- Track status (DRAFT, SENT, APPROVED, EXPIRED, etc.).
- Show list of quotations on client profile.

---

## 3.6 Payments & Payment Methods

### 3.6.1 Payment Methods (`payment_methods`)

- Table: `payment_methods`
- Columns:
  - `id`
  - `code` (UNIQUE) – e.g. CASH, CARD, CHEQUE, BANK, CREDIT
  - `name` – friendly name
  - `active` – boolean

**Functional requirements:**

- Manage active payment methods.
- Filter available methods based on `active`.

### 3.6.2 Payments (`payments`)

- Table: `payments`
- Columns:
  - `id`
  - `invoice_id` (FK → `invoices.id`)
  - `employee_id` (FK → `employees.id`, nullable)
  - `payment_method_id` (FK → `payment_methods.id`)
  - `amount`
  - `paid_at`

**Functional requirements:**

- Allow **multiple payments per invoice**.
- Validate:
  - Sum of `payments.amount` ≤ `invoices.total`.
  - Show **warning/block** when payments would exceed `balance`.
- Tie payment to `employee_id` and `paid_at`.
- Print **payment receipt** with:
  - invoice info
  - payment details
  - store info
  - employee info.

---

## 3.7 Credit Notes & Allocations

### 3.7.1 Credit Notes (`credit_notes`)

- Table: `credit_notes`
- Columns:
  - `id`
  - `client_id` (FK → `clients.id`)
  - `invoice_id` (FK → `invoices.id`, nullable)
  - `employee_id` (FK → `employees.id`, nullable)
  - `amount` – total credit
  - `remaining_amount` – unused credit
  - `status`
  - `reason`
  - `created_at`

### 3.7.2 Credit Note Allocations (`credit_note_allocations`)

- Table: `credit_note_allocations`
- Columns:
  - `id`
  - `credit_note_id` (FK → `credit_notes.id`)
  - `invoice_id` (FK → `invoices.id`)
  - `amount_applied`
  - `applied_at`
  - `employee_id` (FK → `employees.id`, nullable)

**Functional requirements:**

- Support issuing credit notes against client/invoice.
- Allow allocation of credit note amounts to one or more invoices using `credit_note_allocations`.
- Keep `remaining_amount` updated.
- Status transitions based on usage:
  - e.g. OPEN → PARTIAL → CLOSED.
- Include in client credit balance calculations.

---

## 3.8 Audit Logs

### 3.8.1 Audit Logs (`audit_logs`)

- Table: `audit_logs`
- Columns:
  - `id`
  - `employee_id` (FK → `employees.id`, nullable)
  - `action` – action code (e.g. `INVOICE_CREATE`, `PAYMENT_ADD`)
  - `reference_type` – entity type (`invoice`, `payment`, `client`, etc.)
  - `reference_id` – entity primary key
  - `created_at`

**Functional requirements:**

- Log key events, including:
  - invoice creation/update/cancel
  - payments
  - credit notes
  - stock changes
  - system settings changes
- Display basic audit trail filtered by:
  - date range
  - employee
  - reference_type

---

## 3.9 System Settings

### 3.9.1 System Settings (`system_settings`)

- Table: `system_settings`
- Columns:
  - `id`
  - `key` (UNIQUE)
  - `value`
  - `group` – category (e.g. TAX, CURRENCY, PRINTING)
  - `description`
  - `readonly` – boolean
  - `visible` – boolean

**Functional requirements:**

- Manage configuration like:
  - default `tax` rate
  - currency
  - invoice numbering behavior
  - store details (name, address, phone, email)
- Respect `readonly` and `visible` flags in UI.
- PIN + permissions required to change settings.

---

## 4. UX & WORKFLOW REQUIREMENTS

### 4.1 Keyboard & Shortcuts

- Use global hotkeys (via React + Mantine hooks, e.g. `useHotkeys`):
  - `F2` – Global search/command palette
  - `F3` – New invoice
  - `F4` – New client
  - `F5` – New part/variant
  - `Ctrl+S` – Save
  - `Ctrl+P` – Print
  - `Esc` – Cancel/close dialog

- Tables/grid:
  - Arrow keys navigate cells.
  - Enter confirms edits / moves down a row.
  - Barcode scan goes directly into variant search.

### 4.2 Printing

- Print views for:
  - Invoice (`invoices` + `invoice_items` + `payments`)
  - Payment receipt
  - Quotation
- Use Electron `webContents.print` or `printToPDF`.
- Templates should show:
  - store info (from `system_settings`)
  - client info
  - invoice details
  - payment breakdown.

---

## 5. DATABASE IMPLEMENTATION NOTES (FOR POSTGRESQL)

Claude, when generating PostgreSQL DDL:

- Use `serial`/`bigserial` or `generated always as identity` for integer PKs.
- Map:
  - SQLite `integer` → `integer`/`bigint`
  - SQLite `real` → `numeric(12,2)` (for money)
  - SQLite `text` → `text` or `varchar` as appropriate
  - Boolean flags (`taxable`, `active`, `using_default_pin`, `readonly`, `visible`, etc.) → `boolean`
  - Timestamps (`*_at`, `start_date`, `end_date`) → `timestamp with time zone`
- Define indices to speed up:
  - `sku`, `barcode`, `clients.name`, `invoices.created_at`, `invoices.status`, `payments.invoice_id`, etc.
- Preserve existing **relationships** as FK constraints.

---

## 6. AI TASKS (FRONTEND-FOCUSED FOR CLAUDE)

Claude, use this document primarily as a **frontend specification**.  
Assume the PostgreSQL schema already exists and is correct.

Your main job is to generate:

---

### 6.1 UI MODULE DESIGN

Generate a **complete frontend module breakdown** for React + Mantine including:

- Folder structure for:
  - Inventory
  - Clients
  - Invoices
  - Quotations
  - Payments
  - Credit Notes
  - Employees
  - Settings
- Component hierarchy for each module:
  - List views
  - Detail views
  - Modal dialogs
  - Form layouts
  - Table grids
  - PDF/Print views

---

### 6.2 SCREENS & UI LAYOUTS

Design modern UI layouts for:

#### Inventory
- Parts list view
- Part detail page
- Variant editor
- Stock adjustment modal
- Media gallery

#### Clients
- Client list
- Client profile + credit view
- Invoice/payment tabs
- Statement preview

#### Invoices
- Invoice editor
- Add-item grid
- Client selector
- Totals panel
- Payment dialog
- Invoice list filter UI

#### Quotations
- Quotation editor
- Convert-to-invoice flow
- Quotation history

#### Credit Notes
- Issue credit note screen
- Allocation screen
- Credit ledger view

#### Employees
- Employee management screen
- Role assignment
- PIN reset UI

#### Settings
- Categorized settings panel
- Permissions screen
- Payment method configuration
- System info

---

### 6.3 KEYBOARD & SPEED UX

Design keyboard-first user experience:

- Navigation patterns
- Data-entry flows
- Shortcut mapping
- Grid editing behavior
- Barcode scanning behavior

Include:
- Suggested keybindings
- Command palette actions
- Focus management strategy
- Modal workflows for PIN verification

---

### 6.4 FRONTEND STATE MANAGEMENT

Propose:

- Query handling (with React Query / TanStack)
- Global state (Zustand / Redux) usage
- Local UI state strategy
- Error handling UX
- Loading behavior design

---

### 6.5 ELECTRON + UI INTEGRATION

Design:

- IPC usage patterns from UI perspective
- Where frontend requests:
  - Parts list
  - Invoice save
  - Print invoice
  - Payment processing
- Error handling when PostgreSQL is unreachable
- UI fallback behavior

---

### 6.6 UI COMPONENT SYSTEM (MANTINE + TAILWIND)

Generate:

- Reusable components:
  - Data table
  - Search input
  - Date picker
  - Modal
  - Form inputs
  - Alert banners
- Design theme:
  - font scale
  - spacing system
  - color logic
  - success/warning/error states
- Dark mode compatibility

---

### 6.7 PRINT VIEW DESIGN

Generate printable UI layouts (React components) for:

- Invoice
- Receipt
- Quotation
- Client statement

Include:
- Paper size handling
- Print margins
- Header/footer format
- Print preview UI

---

### 6.8 ERROR & EDGE STATE UI

Design UI behavior for:

- Overpayment attempt
- Out-of-stock items
- Invalid PIN entry
- Database disconnected
- Permission denied
- Inactive employee

---

### 6.9 RESPONSIVE & WINDOW MANAGEMENT

Describe:

- Fullscreen POS mode
- Window resizing behavior
- Multi-monitor workflows
- OS-level integration (Electron menu, tray, etc.)

---

### 6.10 OUTPUT EXPECTATIONS

Claude should return:

- JSX component outlines
- Layout sketches (textual)
- Folder structures
- Interaction flows
- Keyboard mapping tables
- UI schemas
- Style guidance

Claude should **not** generate SQL or database migrations unless explicitly asked.


