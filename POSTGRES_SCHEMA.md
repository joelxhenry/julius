# PostgreSQL Database Schema for Auto Parts Business System (Optimized)

## Overview

This document defines the **optimized** PostgreSQL database schema for migrating data from a legacy DBF/FoxPro system. The system is an **automotive parts retail and distribution business** with multi-location support, employee management, inventory control, and comprehensive sales tracking.

**Optimization Summary:** Reduced from 30 tables to 20 tables by consolidating redundant structures (includes new variants table for part variants).

---

## Schema Design Principles

1. **Proper data types** - Using appropriate PostgreSQL types (VARCHAR, NUMERIC, DATE, TIMESTAMP, BOOLEAN)
2. **Explicit foreign key constraints** - Enforcing referential integrity with proper cascade rules
3. **Indexes** - On primary keys, foreign keys, and commonly queried fields
4. **Merged historical data** - Using `is_archived` flag instead of separate historical tables
5. **Unified document structures** - Single tables for payments and line items with `document_type` discriminator
6. **Consolidated employee data** - All user/access info merged into employees table
7. **PostgreSQL sequences** - Instead of legacy counter tables

---

## Tables (20 Total)

### 1. Reference/Lookup Tables

#### branches
```sql
CREATE TABLE branches (
    branch_code VARCHAR(5) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);
```

#### categories
```sql
-- Merged account_categories + inventory_categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    category_type VARCHAR(20) NOT NULL CHECK (category_type IN ('account', 'inventory')),
    UNIQUE(category, category_type)
);

CREATE INDEX idx_categories_type ON categories(category_type);
```

---

### 2. Master Data Tables

#### clients
```sql
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    cl_number VARCHAR(20),
    client_name VARCHAR(100) NOT NULL,
    contact VARCHAR(100),
    address1 VARCHAR(200),
    address2 VARCHAR(200),
    phone VARCHAR(100),
    notes TEXT,
    credit NUMERIC(15,2) DEFAULT 0,
    credit_desc VARCHAR(200),
    is_taxable BOOLEAN DEFAULT TRUE,
    discount_pct NUMERIC(5,2) DEFAULT 0,
    credit_limit NUMERIC(15,2) DEFAULT 0,
    credit_terms VARCHAR(50),
    custom1 VARCHAR(100),
    custom2 VARCHAR(100),
    lb_disc NUMERIC(5,2),

    -- Credit status flag (manually set by admin when client has bad credit history)
    is_bad_credit BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_name ON clients(client_name);
CREATE INDEX idx_clients_cl_number ON clients(cl_number);
CREATE INDEX idx_clients_bad_credit ON clients(is_bad_credit);
```

#### suppliers
```sql
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    company VARCHAR(100) UNIQUE NOT NULL,
    address1 VARCHAR(200),
    address2 VARCHAR(200),
    address3 VARCHAR(200),
    phone1 VARCHAR(50),
    phone2 VARCHAR(50),
    fax VARCHAR(50),
    contact1 VARCHAR(100),
    contact2 VARCHAR(100),
    notes TEXT,
    credit NUMERIC(15,2),
    credit_desc VARCHAR(200),
    is_taxable BOOLEAN,
    discount_pct NUMERIC(5,2),
    terms VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suppliers_company ON suppliers(company);
```

#### employees
```sql
-- Merged: employees + salespeople + employee_passwords + automation_passwords
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    last_name VARCHAR(50),
    first_name VARCHAR(50),
    title VARCHAR(50),
    department VARCHAR(50),
    address TEXT,
    phone VARCHAR(50),
    emergency_contact VARCHAR(100),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20),

    -- Salesperson fields (from salespeople table)
    is_salesperson BOOLEAN DEFAULT FALSE,
    commission NUMERIC(10,2),

    -- User access fields (from employee_passwords)
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),  -- Modern hash instead of legacy pc1-pc6

    -- Module permissions (from employee_passwords m1-m9, sm1-sm9)
    permissions JSONB DEFAULT '{}',  -- Flexible JSON for module access

    -- Access codes (from automation_passwords access1-access15)
    access_codes JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employees_code ON employees(code);
CREATE INDEX idx_employees_name ON employees(last_name, first_name);
CREATE INDEX idx_employees_salesperson ON employees(is_salesperson) WHERE is_salesperson = TRUE;
CREATE INDEX idx_employees_username ON employees(username) WHERE username IS NOT NULL;
```

---

### 3. Inventory Tables

#### inventory
```sql
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    location VARCHAR(20),
    description1 VARCHAR(200),
    description2 VARCHAR(200),
    quantity INTEGER DEFAULT 0,
    min_level INTEGER DEFAULT 0,
    is_taxable BOOLEAN DEFAULT TRUE,
    cost NUMERIC(15,2) DEFAULT 0,
    cost_currency VARCHAR(10) DEFAULT 'JA',
    price NUMERIC(15,2) DEFAULT 0,
    price_currency VARCHAR(10) DEFAULT 'JA',
    margin NUMERIC(8,4),
    unit VARCHAR(10) DEFAULT 'EA',
    category VARCHAR(100),
    model VARCHAR(200),
    wholesale_price NUMERIC(15,2),
    icheck VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_sku ON inventory(sku);
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_location ON inventory(location);
```

#### variants
```sql
-- Part variants (different sizes, specifications, etc. of the same base part)
CREATE TABLE variants (
    id SERIAL PRIMARY KEY,
    parent_sku VARCHAR(50) NOT NULL,
    variant_sku VARCHAR(50) UNIQUE NOT NULL,
    variant_name VARCHAR(100),
    variant_type VARCHAR(50),              -- e.g., 'size', 'color', 'specification'
    attributes JSONB DEFAULT '{}',         -- flexible key-value pairs for variant attributes
    description VARCHAR(200),
    quantity INTEGER DEFAULT 0,
    cost NUMERIC(15,2),
    cost_currency VARCHAR(10) DEFAULT 'JA',
    price NUMERIC(15,2),
    price_currency VARCHAR(10) DEFAULT 'JA',
    wholesale_price NUMERIC(15,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_variants_parent FOREIGN KEY (parent_sku) REFERENCES inventory(sku) ON DELETE CASCADE
);

CREATE INDEX idx_variants_parent_sku ON variants(parent_sku);
CREATE INDEX idx_variants_variant_sku ON variants(variant_sku);
CREATE INDEX idx_variants_type ON variants(variant_type);
CREATE INDEX idx_variants_active ON variants(is_active) WHERE is_active = TRUE;
```

**Example usage:**
```sql
-- A brake pad available in different sizes
INSERT INTO variants (parent_sku, variant_sku, variant_name, variant_type, attributes, price)
VALUES
    ('BP-1234', 'BP-1234-S', 'Small', 'size', '{"size": "S", "thickness_mm": 10}', 1500.00),
    ('BP-1234', 'BP-1234-M', 'Medium', 'size', '{"size": "M", "thickness_mm": 12}', 1750.00),
    ('BP-1234', 'BP-1234-L', 'Large', 'size', '{"size": "L", "thickness_mm": 15}', 2000.00);
```

#### inventory_alternates
```sql
CREATE TABLE inventory_alternates (
    id SERIAL PRIMARY KEY,
    part_no VARCHAR(50) NOT NULL,
    alternate_no VARCHAR(50) NOT NULL,
    supplier VARCHAR(100),
    UNIQUE(part_no, alternate_no)
);

CREATE INDEX idx_inv_alt_partno ON inventory_alternates(part_no);
CREATE INDEX idx_inv_alt_altno ON inventory_alternates(alternate_no);
```

#### inventory_categories
```sql
-- Junction table for many-to-many relationship between inventory and categories
CREATE TABLE inventory_categories (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    category_id INTEGER NOT NULL,
    UNIQUE(sku, category_id),
    CONSTRAINT fk_inv_cat_sku FOREIGN KEY (sku) REFERENCES inventory(sku) ON DELETE CASCADE,
    CONSTRAINT fk_inv_cat_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX idx_inv_cat_sku ON inventory_categories(sku);
CREATE INDEX idx_inv_cat_category_id ON inventory_categories(category_id);
```

#### inventory_markup
```sql
CREATE TABLE inventory_markup (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(50),
    sku VARCHAR(50),
    description VARCHAR(200),
    retail_price NUMERIC(15,2),
    quantity INTEGER,
    CONSTRAINT fk_inv_markup_sku FOREIGN KEY (sku) REFERENCES inventory(sku) ON DELETE SET NULL
);

CREATE INDEX idx_inv_markup_sku ON inventory_markup(sku);
```

#### inventory_transactions
```sql
CREATE TABLE inventory_transactions (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    activity VARCHAR(20) NOT NULL,
    reference VARCHAR(50),
    quantity INTEGER NOT NULL,
    activity_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_trans_sku FOREIGN KEY (sku) REFERENCES inventory(sku) ON DELETE CASCADE
);

CREATE INDEX idx_inv_trans_sku ON inventory_transactions(sku);
CREATE INDEX idx_inv_trans_date ON inventory_transactions(activity_date);
CREATE INDEX idx_inv_trans_reference ON inventory_transactions(reference);
```

#### inventory_receiving
```sql
CREATE TABLE inventory_receiving (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    supplier VARCHAR(100),
    receiving_date DATE,
    quantity INTEGER,
    last_cost NUMERIC(15,2),
    last_cost_currency VARCHAR(10),
    prior_cost NUMERIC(15,2),
    prior_cost_currency VARCHAR(10),
    last_price NUMERIC(15,2),
    last_price_currency VARCHAR(10),
    last_wholesale_price NUMERIC(15,2),
    reference VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_rec_sku FOREIGN KEY (sku) REFERENCES inventory(sku) ON DELETE CASCADE,
    CONSTRAINT fk_inv_rec_supplier FOREIGN KEY (supplier) REFERENCES suppliers(company) ON DELETE SET NULL
);

CREATE INDEX idx_inv_rec_sku ON inventory_receiving(sku);
CREATE INDEX idx_inv_rec_supplier ON inventory_receiving(supplier);
```

---

### 4. Sales Documents

#### invoices
```sql
-- Invoice status flow: draft -> active -> partially_paid -> paid -> archived
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    inv_number VARCHAR(20) UNIQUE NOT NULL,
    inv_date DATE NOT NULL,
    inv_time INTEGER,
    salesperson_id INTEGER,
    client_id INTEGER,
    client_name VARCHAR(100),  -- Denormalized for historical records
    client_address1 VARCHAR(200),
    client_address2 VARCHAR(200),
    client_phone VARCHAR(100),
    reference VARCHAR(100),
    sub_total NUMERIC(15,2) DEFAULT 0,
    tax NUMERIC(15,2) DEFAULT 0,
    total NUMERIC(15,2) DEFAULT 0,
    total_paid NUMERIC(15,2) DEFAULT 0,

    -- Status: draft -> active -> partially_paid -> paid -> archived
    status VARCHAR(20) NOT NULL DEFAULT 'draft',

    is_taxable BOOLEAN DEFAULT TRUE,
    pricing VARCHAR(10) DEFAULT 'R',
    credit_terms VARCHAR(50),
    is_archived BOOLEAN DEFAULT FALSE,

    -- Issued tracking (when invoice moves from draft to active)
    issued_at TIMESTAMP,
    issued_by_id INTEGER,

    -- Admin override tracking (for credit block bypass)
    admin_override_by_id INTEGER,
    admin_override_notes TEXT,
    admin_override_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_invoices_salesperson FOREIGN KEY (salesperson_id) REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_issued_by FOREIGN KEY (issued_by_id) REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_admin_override FOREIGN KEY (admin_override_by_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX idx_invoices_number ON invoices(inv_number);
CREATE INDEX idx_invoices_date ON invoices(inv_date);
CREATE INDEX idx_invoices_client ON invoices(client_name);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_salesperson ON invoices(salesperson_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_archived ON invoices(is_archived);
CREATE INDEX idx_invoices_issued_by ON invoices(issued_by_id);
```

#### quotations
```sql
CREATE TABLE quotations (
    id SERIAL PRIMARY KEY,
    quote_num VARCHAR(20) UNIQUE NOT NULL,
    quote_date DATE NOT NULL,
    salesperson_id INTEGER,
    client_id INTEGER,
    client_name VARCHAR(100),  -- Denormalized for historical records
    client_address1 VARCHAR(200),
    client_address2 VARCHAR(200),
    client_phone VARCHAR(100),
    reference VARCHAR(100),
    sub_total NUMERIC(15,2) DEFAULT 0,
    tax NUMERIC(15,2) DEFAULT 0,
    total NUMERIC(15,2) DEFAULT 0,
    is_taxable BOOLEAN DEFAULT TRUE,
    pricing VARCHAR(10) DEFAULT 'R',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quotes_salesperson FOREIGN KEY (salesperson_id) REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_quotes_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE INDEX idx_quotes_number ON quotations(quote_num);
CREATE INDEX idx_quotes_date ON quotations(quote_date);
CREATE INDEX idx_quotes_client ON quotations(client_name);
CREATE INDEX idx_quotes_client_id ON quotations(client_id);
CREATE INDEX idx_quotes_archived ON quotations(is_archived);
```

#### credit_notes
```sql
CREATE TABLE credit_notes (
    id SERIAL PRIMARY KEY,
    cr_number VARCHAR(20) UNIQUE NOT NULL,
    inv_number VARCHAR(20),
    cr_date DATE NOT NULL,
    salesperson_id INTEGER,
    client_id INTEGER,
    client_name VARCHAR(100),  -- Denormalized for historical records
    client_address1 VARCHAR(200),
    client_address2 VARCHAR(200),
    client_phone VARCHAR(100),
    reference VARCHAR(100),
    sub_total NUMERIC(15,2) DEFAULT 0,
    tax NUMERIC(15,2) DEFAULT 0,
    total NUMERIC(15,2) DEFAULT 0,
    total_used NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(10) DEFAULT 'A',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_crnotes_invoice FOREIGN KEY (inv_number) REFERENCES invoices(inv_number) ON DELETE SET NULL,
    CONSTRAINT fk_crnotes_salesperson FOREIGN KEY (salesperson_id) REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_crnotes_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE INDEX idx_crnotes_number ON credit_notes(cr_number);
CREATE INDEX idx_crnotes_inv ON credit_notes(inv_number);
CREATE INDEX idx_crnotes_date ON credit_notes(cr_date);
CREATE INDEX idx_crnotes_client ON credit_notes(client_name);
CREATE INDEX idx_crnotes_client_id ON credit_notes(client_id);
CREATE INDEX idx_crnotes_archived ON credit_notes(is_archived);
```

#### document_line_items
```sql
-- Unified table for: invoice_details + quotation_details + credit_note_details
CREATE TABLE document_line_items (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(10) NOT NULL CHECK (document_type IN ('INVOICE', 'QUOTE', 'CREDIT')),
    document_number VARCHAR(20) NOT NULL,
    line_number INTEGER NOT NULL,
    sku VARCHAR(50),
    description VARCHAR(200),
    quantity NUMERIC(15,4) DEFAULT 0,
    unit_price NUMERIC(15,2) DEFAULT 0,
    discount NUMERIC(10,2) DEFAULT 0,
    is_taxable BOOLEAN DEFAULT TRUE,
    amount NUMERIC(15,2) DEFAULT 0,
    UNIQUE(document_type, document_number, line_number),
    CONSTRAINT fk_doc_items_sku FOREIGN KEY (sku) REFERENCES inventory(sku) ON DELETE SET NULL
);

CREATE INDEX idx_doc_items_type_number ON document_line_items(document_type, document_number);
CREATE INDEX idx_doc_items_sku ON document_line_items(sku);
CREATE INDEX idx_doc_items_invoice ON document_line_items(document_number) WHERE document_type = 'INVOICE';
CREATE INDEX idx_doc_items_quote ON document_line_items(document_number) WHERE document_type = 'QUOTE';
CREATE INDEX idx_doc_items_credit ON document_line_items(document_number) WHERE document_type = 'CREDIT';
```

#### payments
```sql
-- Unified table for: invoice_payments + credit_note_payments + bill_payments
-- Uses nullable FKs to link to the appropriate parent document
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(10) NOT NULL CHECK (document_type IN ('INVOICE', 'CREDIT', 'BILL')),
    document_number VARCHAR(50) NOT NULL,
    invoice_number VARCHAR(20),      -- FK to invoices (when document_type = 'INVOICE')
    credit_note_number VARCHAR(20),  -- FK to credit_notes (when document_type = 'CREDIT')
    bill_number VARCHAR(50),         -- FK to bills (when document_type = 'BILL')
    payer_name VARCHAR(100),  -- client_name or supplier
    payment_date DATE,
    payment_desc VARCHAR(100),
    payment_desc2 VARCHAR(100),
    amount NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_number) REFERENCES invoices(inv_number) ON DELETE CASCADE,
    CONSTRAINT fk_payments_credit_note FOREIGN KEY (credit_note_number) REFERENCES credit_notes(cr_number) ON DELETE CASCADE,
    CONSTRAINT fk_payments_bill FOREIGN KEY (bill_number) REFERENCES bills(bill_no) ON DELETE CASCADE,
    -- Ensure the appropriate FK is set based on document_type
    CONSTRAINT chk_payment_fk CHECK (
        (document_type = 'INVOICE' AND invoice_number IS NOT NULL AND credit_note_number IS NULL AND bill_number IS NULL) OR
        (document_type = 'CREDIT' AND credit_note_number IS NOT NULL AND invoice_number IS NULL AND bill_number IS NULL) OR
        (document_type = 'BILL' AND bill_number IS NOT NULL AND invoice_number IS NULL AND credit_note_number IS NULL)
    )
);

CREATE INDEX idx_payments_type_number ON payments(document_type, document_number);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_invoice ON payments(invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX idx_payments_credit ON payments(credit_note_number) WHERE credit_note_number IS NOT NULL;
CREATE INDEX idx_payments_bill ON payments(bill_number) WHERE bill_number IS NOT NULL;
```

---

### 5. Purchasing/Bills

#### bills
```sql
CREATE TABLE bills (
    id SERIAL PRIMARY KEY,
    bill_no VARCHAR(50) UNIQUE NOT NULL,
    supplier VARCHAR(100),
    bill_date DATE,
    order_no VARCHAR(50),
    description VARCHAR(200),
    category VARCHAR(100),
    sub_total NUMERIC(15,2) DEFAULT 0,
    tax NUMERIC(15,2) DEFAULT 0,
    total NUMERIC(15,2) DEFAULT 0,
    bill_currency VARCHAR(10),
    total_paid NUMERIC(15,2) DEFAULT 0,
    pay_date DATE,
    ordered_by VARCHAR(50),
    status VARCHAR(10) DEFAULT 'A',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bills_supplier FOREIGN KEY (supplier) REFERENCES suppliers(company) ON DELETE SET NULL
);

CREATE INDEX idx_bills_number ON bills(bill_no);
CREATE INDEX idx_bills_supplier ON bills(supplier);
CREATE INDEX idx_bills_date ON bills(bill_date);
```

---

### 6. Employee/HR Tables

#### employee_attendance
```sql
-- Merged: employee_time + employee_log
CREATE TABLE employee_attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER,
    last_name VARCHAR(50),   -- Kept for legacy data without employee_id
    first_name VARCHAR(50),
    department VARCHAR(50),
    log_date DATE NOT NULL,
    log_type VARCHAR(10) NOT NULL CHECK (log_type IN ('DAILY', 'EVENT')),

    -- For DAILY records (from employee_time)
    in_time_1 INTEGER,
    out_time_1 INTEGER,
    in_time_2 INTEGER,
    out_time_2 INTEGER,
    in_time_3 INTEGER,
    out_time_3 INTEGER,

    -- For EVENT records (from employee_log)
    activity VARCHAR(10),  -- IN/OUT
    activity_time INTEGER,

    activity_desc VARCHAR(50),  -- NORMAL DAY, etc.

    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX idx_attendance_date ON employee_attendance(log_date);
CREATE INDEX idx_attendance_employee ON employee_attendance(employee_id);
CREATE INDEX idx_attendance_type ON employee_attendance(log_type);
CREATE INDEX idx_attendance_name ON employee_attendance(last_name, first_name);
```

---

### 7. System Tables

#### gct_payments
```sql
CREATE TABLE gct_payments (
    id SERIAL PRIMARY KEY,
    month INTEGER,
    year INTEGER,
    deduction NUMERIC(15,2),
    amount NUMERIC(15,2),
    UNIQUE(month, year)
);
```

---

## PostgreSQL Sequences (Replace counters table)

```sql
-- Set these after migration based on max values from legacy data
CREATE SEQUENCE seq_invoice_number START WITH 65524;
CREATE SEQUENCE seq_credit_note_number START WITH 3658;
CREATE SEQUENCE seq_quote_number START WITH 14383;
CREATE SEQUENCE seq_purchase_order_number START WITH 1001;
CREATE SEQUENCE seq_transfer_number START WITH 6408;
```

---

## Entity Relationship Summary

```
                    ┌─────────────┐
                    │  branches   │
                    └─────────────┘

        ┌─────────────┐                 ┌─────────────┐
        │  employees  │                 │   clients   │
        │(+salesperson│                 └──────┬──────┘
        │ +user access)│                       │ FK
        └──────┬──────┘                        │
               │ FK                            │
        ┌──────┼──────────────────┬────────────┤
        │      │                  │            │
        ▼      ▼                  ▼            ▼
  ┌──────────┐      ┌──────────┐      ┌──────────────┐
  │ invoices │◄─────│quotations│      │ credit_notes │
  └────┬─────┘      └────┬─────┘      └──────┬───────┘
       │                 │                   │
       └─────────────────┼───────────────────┘
                         ▼
              ┌─────────────────────┐
              │ document_line_items │
              │  (type: INV/QTE/CR) │
              └──────────┬──────────┘
                         │ FK
                         ▼
                  ┌─────────────┐
                  │  inventory  │
                  └──────┬──────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
       ┌────────┐  ┌──────────┐  ┌─────────┐
       │inv_alt │  │inv_trans │  │ inv_rec │
       └────────┘  └──────────┘  └────┬────┘
                                      │ FK
                                      ▼
                               ┌─────────────┐
                               │  suppliers  │
                               └──────┬──────┘
                                      │ FK
                                      ▼
                               ┌─────────────┐
                               │    bills    │
                               └─────────────┘

              ┌─────────────────────┐
              │      payments       │──────┐
              │(type: INV/CR/BILL)  │      │ FK to invoices, credit_notes, bills
              └─────────────────────┘      │
                                           ▼
```

---

## Foreign Key Constraints Summary

| Child Table | Parent Table | FK Column | On Delete |
|-------------|--------------|-----------|-----------|
| invoices | employees | salesperson_id | SET NULL |
| invoices | clients | client_id | SET NULL |
| invoices | employees | issued_by_id | SET NULL |
| invoices | employees | admin_override_by_id | SET NULL |
| quotations | employees | salesperson_id | SET NULL |
| quotations | clients | client_id | SET NULL |
| credit_notes | invoices | inv_number | SET NULL |
| credit_notes | employees | salesperson_id | SET NULL |
| credit_notes | clients | client_id | SET NULL |
| document_line_items | inventory | sku | SET NULL |
| payments | invoices | invoice_number | CASCADE |
| payments | credit_notes | credit_note_number | CASCADE |
| payments | bills | bill_number | CASCADE |
| bills | suppliers | supplier | SET NULL |
| inventory_transactions | inventory | sku | CASCADE |
| inventory_receiving | inventory | sku | CASCADE |
| inventory_receiving | suppliers | supplier | SET NULL |
| inventory_markup | inventory | sku | SET NULL |
| variants | inventory | parent_sku | CASCADE |
| inventory_categories | inventory | sku | CASCADE |
| inventory_categories | categories | category_id | CASCADE |
| employee_attendance | employees | employee_id | SET NULL |

---

## Data Migration Notes

### Migration Order (respecting foreign key dependencies)

**Phase 1: Reference Tables (no dependencies)**
1. `branches` ← BRANCHES.json (2 records)
2. `categories` ← ACATEGOR.json + ICATEGOR.json (47 records, add category_type)

**Phase 2: Master Data**
3. `clients` ← CLIENT.json (805 records)
4. `suppliers` ← SUPPLIER.json (182 records)
5. `employees` ← EMPNAME.json + SALESPER.json + EMPASS.json + AUTPASS.json (merge by name/code)
6. `inventory` ← INVENTRY.json (15,284 records)

**Phase 3: Sales Document Headers**
7. `invoices` ← INVOICE.json + H_INVOIC.json + HIST-1.json (157,216 records)
8. `quotations` ← QUOTE.json + H_QUOTE.json (6,068 records)
9. `credit_notes` ← CRNOTE.json + H_CRNOTE.json (15,077 records)

**Phase 4: Purchasing (must come before payments for FK resolution)**
10. `bills` ← BILL.json (16,961 records)

**Phase 5: Unified Detail Tables & Payments**
11. `document_line_items` ← INVDETAI + H_INVDET + HIST-2 + QTEDETAI + H_QTEDET + CRNDETAI + H_CRNDET (290,510 records)
12. `payments` ← INVPAY + H_INVPAY + HIST-3 + CRNPAY + H_CRNPAY + BILLPAY (190,609 records)
    - Links to invoices via `invoice_number` FK
    - Links to credit_notes via `credit_note_number` FK
    - Links to bills via `bill_number` FK

**Phase 6: Inventory Supporting**
13. `inventory_transactions` ← INVENTRA.json (125,026 records)
14. `inventory_receiving` ← INVREC.json (15,695 records)
15. `inventory_alternates` ← INV_ALT.json (25,702 records)
16. `inventory_markup` ← INV_MARK.json (189 records)
17. `inventory_categories` ← INVENTRY.json category field (many-to-many junction)

**Phase 7: HR**
18. `employee_attendance` ← EMPTIME.json + EMPLOG.json (23,046 records)
19. `gct_payments` ← GCTPAY.json (38 records)

**Phase 8: Sequences**
Set sequence values based on COUNTER.json max values.

---

## Tables Eliminated by Optimization

| Original Table | Action | Reason |
|----------------|--------|--------|
| salespeople | Merged → employees | Only 6 records, same people as employees |
| part_names | Eliminated | Redundant with inventory.description1 |
| counters | Eliminated | Use PostgreSQL SEQUENCE instead |
| account_categories | Merged → categories | Combined with inventory_categories |
| inventory_categories | Merged → categories | Combined with account_categories |
| employee_passwords | Merged → employees | User access for same employees |
| automation_passwords | Merged → employees | User access for same employees |
| employee_time | Merged → employee_attendance | Same attendance data |
| employee_log | Merged → employee_attendance | Same attendance data |
| error_log | Eliminated | Legacy FoxPro errors (1999-2000), not useful |
| invoice_details | Merged → document_line_items | Identical structure |
| quotation_details | Merged → document_line_items | Identical structure |
| credit_note_details | Merged → document_line_items | Identical structure |
| invoice_payments | Merged → payments | Identical structure |
| credit_note_payments | Merged → payments | Identical structure |
| bill_payments | Merged → payments | Identical structure |

**Result: 30 tables → 20 tables (33% reduction)**

---

## Data Quality Considerations

1. **Invalid dates** - Some payment dates have invalid years (e.g., 8201, 5201). Set to NULL during migration.
2. **Empty primary keys** - CLIENT.CL_NUMBER is often empty; use auto-generated IDs.
3. **Negative discounts** - Normalize to positive values during migration.
4. **Currency codes** - "JA" for Jamaican Dollar is the primary currency.
5. **Boolean conversion** - Convert Y/N strings to proper booleans.
6. **Duplicate invoice numbers** - Check for conflicts when merging active + historical data.
7. **Employee matching** - Match salespeople/passwords to employees by name during migration.
8. **Document type mapping** - Set document_type correctly when populating unified tables.

---

## Total Record Count Summary

| Category | Records |
|----------|---------|
| Reference/Lookup | ~49 |
| Master Data | ~16,300 |
| Sales Document Headers | ~178,000 |
| Document Line Items (unified) | ~290,500 |
| Payments (unified) | ~190,600 |
| Purchasing | ~17,000 |
| Inventory Supporting | ~167,000 |
| HR/Attendance | ~23,100 |
| **Total** | **~882,500** |

---

## Tables Summary (20 Total)

| # | Table Name | Records | Foreign Keys |
|---|------------|---------|--------------|
| 1 | branches | 2 | - |
| 2 | categories | 47 | - |
| 3 | clients | 805 | - |
| 4 | suppliers | 182 | - |
| 5 | employees | ~16 | - |
| 6 | inventory | 15,284 | - |
| 7 | variants | 0 (new) | inventory |
| 8 | invoices | 157,216 | employees, clients |
| 9 | quotations | 6,068 | employees, clients |
| 10 | credit_notes | 15,077 | invoices, employees, clients |
| 11 | document_line_items | 290,510 | inventory |
| 12 | payments | 190,609 | invoices, credit_notes, bills |
| 13 | bills | 16,961 | suppliers |
| 14 | inventory_transactions | 125,026 | inventory |
| 15 | inventory_receiving | 15,695 | inventory, suppliers |
| 16 | inventory_alternates | 25,702 | - |
| 17 | inventory_markup | 189 | inventory |
| 18 | inventory_categories | ~15,284 | inventory, categories |
| 19 | employee_attendance | 23,046 | employees |
| 20 | gct_payments | 38 | - |

---

## Benefits of Optimized Schema

1. **Fewer tables** - 20 vs 30 (33% reduction)
2. **Simpler queries** - Unified payments/line items tables
3. **Better data integrity** - Employee data consolidated
4. **Modern PostgreSQL features** - JSONB for permissions, sequences for counters
5. **No legacy cruft** - Removed obsolete error logs
6. **Easier maintenance** - Fewer tables to manage
7. **Flexible permissions** - JSONB instead of 20+ boolean columns
