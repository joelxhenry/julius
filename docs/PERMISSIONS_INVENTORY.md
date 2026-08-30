# Julius — System Inventory for Permissions Module

Exhaustive catalog of every **page, view, tab/panel, section, dashboard, and action button** in the
app, organized by module, to serve as the authority list for the permissions module. Verified by
reading every page and component file (not inferred). Cross-referenced against the router
(`src/renderer/router/index.tsx`) and the IPC action surface (`src/shared/types/ipc.ts`).

**Legend:** VIEW = displayed data/section · TAB/PANEL = tab, sub-panel, or collapsible ·
ACTION = clickable button / menu item / interactive control · 🔒 = sensitive/override action.

---

## 0. What already exists (permission scaffolding)

The groundwork is partially built — the new module should extend it, not start fresh:

- **Storage**: `employees.permissions` (`src/main/database/schema/employees.ts`) — JSONB
  `Record<string, boolean>`; plus a separate `accessCodes` JSONB column.
- **Definitions**: `src/shared/constants/permissions.ts` — 9 categories, ~35 permission codes.
- **Editor UI**: `EmployeePermissionsPage.tsx` at `/employees/:id/permissions` — accordion by
  category, per-permission + per-category toggles.
- **Route gating**: `src/renderer/router/permissions.ts` — routes → permission codes, with
  `public` / `authenticated` / `permission-protected` / `password-protected` tiers + `ADMIN` bypass.
- **Live enforcement today** (the only places permissions are actually checked in the UI):
  - `PinVerificationModal` gates **New Invoice / Issue Invoice** with `CREATE_INVOICE`.
  - `AdminOverrideModal` gates credit-limit bypass with `ADMIN` / `OVERRIDE_CREDIT` via `VERIFY_ACCESS_CODE`.
  - `StockOverrideModal` gates negative-stock bypass with `ADMIN` / `ADJUST_STOCK` via `VERIFY_ACCESS_CODE`.
  - `CHECK_SALESPERSON_ACCESS` / `VERIFY_ACCESS_CODE` primitives exist for access-code checks.
- Otherwise, **most actions are currently ungated** — no `hasPermission()`/`can()` wrapping in the
  Clients, Suppliers, Payments, Inventory, Credit Note, or Quotation UIs. This inventory is the
  basis for wiring them.

> **Key gap:** the current permission list covers only ~9 modules coarsely. It omits Clients,
> Suppliers, Sales Management, Reports, Goods Receival, Mass Update, Void Payment, Export, and the
> override actions. See §16 for the recommended expanded code set.

---

## 1. Global / Cross-cutting surfaces

### Navigation (`Sidebar.tsx`)
| Group | Items |
|---|---|
| Main | Home |
| Business | Inventory, Receive Parts, New Invoice, New Quotation, Clients, Suppliers, Payments, Attendance |
| Admin | Dashboard |

### Header (`Header.tsx`)
- ACTION: Quick/Spotlight Search (Ctrl+K) → `SPOTLIGHT_SEARCH`
- ACTION: Toggle theme · Toggle sidebar
- ACTION: Profile menu → **Profile**, **Logout**

### Other global widgets
- **Spotlight** (`common/Spotlight.tsx`) — cross-entity search
- **Marked Items Tray** (`components/tray/`) — cross-entity "mark" launcher/tray (Mark buttons appear
  on inventory rows, variants, alternates, detail headers)
- **Multi-tab workspace** (`layout/TabContainer.tsx`, `TabBar.tsx`)
- **Print** (§14) and **Export** (used in Clients, Suppliers, Reports)

---

## 2. Dashboard (`/dashboard`)

Landing hub (`DashboardPage.tsx`) — 5 navigation cards (each a candidate top-level gate):

| Card | Path |
|---|---|
| Inventory Management | `/inventory/manage` |
| Sales Management | `/sales` |
| Reports | `/reports` |
| System Settings | `/settings` |
| Employee Management | `/employees` |

---

## 3. Invoices

### 3.1 Invoices List (`/invoices`) — `InvoicesPage.tsx`
- VIEW: title + subtitle; search bar; `DateRangeFilter`; status `SegmentedControl`
  (All / Active / Partial / Paid / Archived / Cancelled); two data tables.
- VIEW columns: Invoice #, Date (sort), Client ("Walk-in Customer" if null), Total (sort), Paid,
  Status badge, actions.
- TAB: **Recent** (up to 20) · TAB: **All** (search results, ≥2 chars).
- ACTION 🔒: **New Invoice** → `PinVerificationModal` (requires `CREATE_INVOICE`) → `/invoices/form`.
- ACTION: Search (debounced) · Status filter · Date filter · Column sort · Row click → detail ·
  **View** (eye).
- IPC: `GET_INVOICES_PAGINATED`, `SEARCH_INVOICES`, `GET_RECENT_INVOICES`.

### 3.2 Invoice Create / Edit (`/invoices/form`, `/invoices/edit/:id`) — `InvoiceCreatePage.tsx`
- VIEW: "Latest Invoices" strip; `CompactInvoiceToolbar` (live totals); `CompactFormBar`;
  `InvoiceLineItemsTable`; `FloatingAlerts`.
- **CompactFormBar** inputs: client `Autocomplete`, date, reference, Pricing select (Retail/Wholesale),
  Credit Terms, Taxable switch ("GCT {rate}%"), collapsible **Notes** panel.
- **InvoiceLineItemsTable**: `ProductSearchPanel` (part/category/model search) + editable rows
  (SKU, Description, Qty, Unit Price, Disc %, Amount); low-stock badge; inline inventory-warning alert;
  **Replace with alternative** menu; delete row; keyboard cell navigation.
- ACTIONS (toolbar):
  - 🔒 **Save & Issue** (or **Cancel Invoice** when edited to zero items) — stock check →
    `StockOverrideModal` if short; credit check → `AdminOverrideModal`; then `CREATE_INVOICE` /
    `UPDATE_INVOICE` + line items + `CREATE_INVOICE_TRANSACTIONS` / `REISSUE_INVOICE_TRANSACTIONS`.
  - 🔒 **Save & Pay** — same gates → `PaymentEntryModal` → `CREATE_INVOICE_WITH_PAYMENT`.
  - **Keyboard Shortcuts** help.
- ACTION (keyboard): Ctrl+S issue; Ctrl+Alt+D bulk discount; Ctrl+T target total; Ctrl+Q qty;
  Ctrl+Shift+D discount; Delete line; ↑/↓ select line.
- 🔒 **Bulk Discount** (`BulkDiscountModal`) — uniform % across all lines.
- 🔒 **Target Total** (`TargetTotalModal`) — back-calculates discount to hit a target total.
- **VariantSelectorModal** — pick a variant when a product has variants.
- IPC: `CREATE_INVOICE`, `UPDATE_INVOICE`, `CREATE_INVOICE_WITH_PAYMENT`, `CHECK_INVOICE_INVENTORY`,
  `ADJUST_STOCK_BY_SKU`, `CREATE_INVOICE_TRANSACTIONS`, `REISSUE_INVOICE_TRANSACTIONS`,
  `CHECK_CLIENT_CREDIT`, document-line-item channels.

### 3.3 Invoice Detail (`/invoices/:id`) — `InvoiceDetailPage.tsx`
- VIEW: `CompactDetailHeader` (number, status, Total/Paid/Balance, prev/next nav);
  `CompactDetailInfoBar` (client, salesperson, date, reference, terms, pricing links);
  **"Admin Override Applied"** alert (when `adminOverrideById` set); Notes panel;
  `InvoiceLineItemsReadOnly` (with subtotal/tax/total).
- TAB/PANEL: **Payment History** collapsible (`PaymentHistoryCard`, "$X paid" badge);
  **Credit Notes** collapsible (CR #, Date, Total, Remaining, Status; or empty).
- ACTIONS (header): **Edit** (active/partial only) · **Record Payment** (`RecordPaymentModal`) ·
  🔒 **Process Return** (`ProcessReturnModal`) · overflow → **View Client**, **Create Credit Note**,
  🔒 **Archive Invoice** (`ARCHIVE_INVOICE`).
- ACTIONS: **Lookup Ticket** (print) · **Print** (invoice) · Client/Salesperson links · Prev/Next
  invoice nav · Credit-note row **View Credit Note**.
- IPC: `GET_INVOICE`, `GET_ADJACENT_INVOICES_WITH_DATA`, `ARCHIVE_INVOICE`, plus payment/return channels.

### 3.4 Invoice-related modals (permission-relevant)
- 🔒 **AdminOverrideModal** — "Approve Override" via `VERIFY_ACCESS_CODE`, requires `ADMIN`/`OVERRIDE_CREDIT`.
- 🔒 **StockOverrideModal** — per-item on-hand correction (`ADJUST_STOCK_BY_SKU`) + "Approve & Issue
  (allow negative stock)"; verify via `VERIFY_ACCESS_CODE`, requires `ADMIN`/`ADJUST_STOCK`.
- **RecordPaymentModal** / **PaymentEntryModal** / **ApplyCreditNoteModal** / **ProcessReturnModal** —
  see §5 and §10.

> Legacy/unwired invoice components also exist (`InvoiceCreateHeader`, `InvoiceSummaryCard`,
> `InvoiceFormHeader`, `InvoiceDetailHeader`, `InvoiceClientDetailsSection`, `InventoryWarningModal`) —
> not imported by the three live pages.

---

## 4. Quotations

**Pages:** List `/quotations` (tabs **Recent**, **All**) · Create `/quotations/new` ·
Detail `/quotations/:id` · Edit `/quotations/:id/edit`. Create/edit uses `CompactQuotationToolbar`
("Save Quotation") and `PriceChangeWarningModal`.

**Actions:** View/Search · Create (`CREATE_QUOTATION`) · Edit (`UPDATE_QUOTATION`) ·
Delete (`DELETE_QUOTATION`) · 🔒 **Convert to invoice** (`CONVERT_QUOTATION_TO_INVOICE`) ·
Expire (`EXPIRE_QUOTATION`) · Archive (`ARCHIVE_QUOTATION`) · Print. List gated by `PinVerificationModal`
in places (mirrors invoices).

---

## 5. Credit Notes

> There is **no standalone create/edit Credit Note form**. Credit notes are created programmatically
> by the **Process Return** flow and the invoice header's **Create Credit Note** action.

### 5.1 Credit Notes List (`/credit-notes`) — `CreditNotesPage.tsx`
- VIEW: search (CR #, invoice #, client; ≥2 chars, debounced); DataTable columns CR #, Invoice #,
  Date (sort), Client, Total (sort), Remaining, Status (Active/Used/Archived).
- TAB: **Recent** · TAB: **All** (search, count badge).
- ACTION: Row click → detail · **View** (eye) → new tab · Column sort.
- IPC: `GET_CREDIT_NOTES_PAGINATED`.

### 5.2 Credit Note Detail (`/credit-notes/:id`) — `CreditNoteDetailPage.tsx`
- VIEW: header (CR #, status, Total/Used/Remaining); info bar (Date, Client, Source Invoice link,
  Reference, Salesperson link); `InvoiceLineItemsReadOnly`.
- ACTION: Back · **View Invoice** (source) · Salesperson link · **Print** (credit_note) ·
  overflow → 🔒 **Archive Credit Note** (`ARCHIVE_CREDIT_NOTE`, only when not archived).
- IPC: `GET_CREDIT_NOTE`, `GET_DOCUMENT_LINE_ITEMS_BY_CREDIT_NOTE`, `ARCHIVE_CREDIT_NOTE`,
  `GET_INVOICE_BY_NUMBER`.

### 5.3 ProcessReturnModal (`components/invoices/ProcessReturnModal.tsx`) — from Invoice Detail
- VIEW: source invoice info; return date; line-item table (checkbox, editable return Qty);
  **Refund Method** `SegmentedControl` (Cash / Bank Transfer / Credit Note / Card Void); reference;
  reduction totals.
- ACTION 🔒: **Process Return** → `PROCESS_INVOICE_RETURN` (restore inventory) →
  delete/update line items → `UPDATE_INVOICE` → either `CREATE_CREDIT_NOTE` (+ line items) or
  `PROCESS_INVOICE_REFUND` (money refund).

### 5.4 ApplyCreditNoteModal — nested in RecordPaymentModal
- ACTION: **Apply Credit** → `PROCESS_INVOICE_PAYMENT` with a `credit_note` entry.
- IPC: `GET_CLIENT_AVAILABLE_CREDIT_NOTES`, `PROCESS_INVOICE_PAYMENT`.

Related channels: `RECORD_CREDIT_NOTE_USAGE`, `RESTORE_CREDIT_NOTE_INVENTORY`, `DELETE_CREDIT_NOTE`.

---

## 6. Sales Management (`/sales`)

Hub (`SalesManagementPage.tsx`) with collapsible side-nav sections: **Invoices**, **Quotations**,
**Credit Notes** — a consolidated shell over §3–5. Back-to-Dashboard control.

---

## 7. Inventory

### 7.1 Inventory List (`/inventory`) — `InventoryListPage.tsx`
- VIEW: search; **Filter by vehicle** (category) + **Filter by model** autocompletes; DataTable
  (Part Number + copy + low-stock icon, Description, Vehicle/Model badges, Stock badge, Price, Mark).
- ACTION: **Add Part** (`NewPartModal`) · Search · Filters · Refresh · Row click → detail · Mark ·
  Pagination.
- IPC: `GET_INVENTORY_PAGINATED`, `GET_DISTINCT_CATEGORIES`, `GET_DISTINCT_MODELS`.

### 7.2 Inventory Detail (`/inventory/:id`) — `InventoryDetailPage.tsx`
- VIEW: header (thumbnail → image modal, SKU, copy, Mark, Low Stock badge, Taxable badge, category,
  model); summary cards (Quantity/Min, Cost, Price, Wholesale, Margin).
- TABS: **Overview**, **Pricing**, **Variants**, **Alternates**, **Activity** (value `transactions`),
  **Sales**, **Receiving**.
- ACTIONS (header): Back · **Lookup Ticket** (print/preview) · 🔒 **Adjust Stock** · **Edit** (`InventoryEditModal`).
- 🔒 **Adjust Stock modal**: variant select, mode (Set / Add / Subtract), qty, reason →
  `SET_VARIANT_STOCK` or `UPDATE_INVENTORY_STOCK` + `CREATE_INVENTORY_TRANSACTION` (ADJ).
- **Add/Edit Variant modal** (`VariantForm`) → `CREATE_VARIANT` / `UPDATE_VARIANT`.
- **Add Alternate modal** (`AlternateForm`) → `CREATE_INVENTORY_ALTERNATE`.

**Per-tab detail:**
- **Overview** (`OverviewTab`): Product Details panel (Part #, Unit, Vehicle & Models, Additional
  Description); copy SKU. Read-only.
- **Pricing** (`PricingTab`): Cost, Selling, Wholesale, Margin %, Taxable. Read-only.
- **Variants** (`VariantsTab`): table (Variant Part ID, Name, Location, Qty, Price, Status, Mark);
  ACTION **Add Variant**; row menu **Edit** / 🔒 **Delete** (`DELETE_VARIANT`); Mark; copy.
- **Alternates** (`AlternatesTab`): resolved alternate parts table; ACTION **Add Alternate**;
  navigate to alternate; 🔒 **Remove alternate** (`DELETE_INVENTORY_ALTERNATE`).
- **Activity** (`TransactionsTab`): activity-type filter (Received/Sold/Adjustment/Return/Transfer),
  variant filter, date filter, clear; reference links open source doc. Read-only ledger
  (`GET_INVENTORY_TRANSACTIONS_BY_SKU`).
- **Sales** (`SalesTab`): summary cards (Total Sold, Revenue, Avg Price, Transactions); variant/date
  filters; sales table with document links (`GET_VARIANT_SALES`, `GET_INVENTORY_SALES_SUMMARY`).
- **Receiving** (`ReceivingTab`): read-only receival history grouped by reference; date filter;
  supplier links; per-group **View** / **Export** (CSV/Excel → `EXPORT_REPORT`) / **Print / PDF /
  Preview** (receiving reference). `GET_INVENTORY_RECEIVING_BY_SKU`.

### 7.3 Inventory management pages
- **InventoryEditorPage** (`/inventory/new`): panels Basic Info, Location & Stock, Pricing, Variants;
  ACTION **Add Variant**, **Create Item** → `CREATE_INVENTORY` + `CREATE_VARIANT` per variant.
- **InventoryEditModal**: edits SKU/description/category/model/location/unit/minLevel/taxable
  (NOT qty/pricing) → `UPDATE_INVENTORY`.
- **Inventory Management hub** (`/inventory/manage`, `InventoryManagementPage`): cards **Update Stock**,
  **Receive Parts**, **Mass Update**.
- 🔒 **BulkStockUpdatePage** (`/inventory/manage/stock`): add items, per-row Set/Delta + reason,
  Apply → confirm → `UPDATE_INVENTORY_STOCK` + `CREATE_INVENTORY_TRANSACTION` (ADJ) per row.
- 🔒 **MassUpdatePage** (`/inventory/manage/mass-update`): download template (CSV/Excel), upload file,
  preview diffs, reason for qty changes, Apply → `UPDATE_INVENTORY` (+ `UPDATE_INVENTORY_STOCK` /
  `CREATE_INVENTORY_TRANSACTION` for qty); downloadable error report.
- 🔒 **GoodsReceivalPage** (`/inventory/manage/receive`): receival details (supplier, date, reference,
  notes); add items (new part / **Import file** / search); per-line received qty, unit cost, pricing
  override popover; **Review & Post** → `POST_GOODS_RECEIVAL`; receiving-report print. Import via
  `PARSE_RECEIVAL_IMPORT` + **ReceivalImportReviewModal** (match existing / create new / skipped rows).
- **NewPartModal** (`pages/inventory/NewPartModal.tsx`): inline part creation.

IPC (writes): `CREATE_INVENTORY`, `UPDATE_INVENTORY`, `DELETE_INVENTORY`, `UPDATE_INVENTORY_STOCK`,
`SET_VARIANT_STOCK`, `UPDATE_VARIANT_STOCK`, `CREATE/UPDATE/DELETE_VARIANT`,
`CREATE/DELETE_INVENTORY_ALTERNATE`, `CREATE_INVENTORY_TRANSACTION`, `POST_GOODS_RECEIVAL`,
`PARSE_RECEIVAL_IMPORT`, image channels (`UPLOAD/DELETE_INVENTORY_IMAGE`, `SET_PRIMARY_IMAGE`,
`REORDER_IMAGES`).

---

## 8. Clients

### 8.1 Clients List (`/clients`) — `ClientsPage.tsx`
- VIEW: search; **Bad Credit Only** + **Taxable Only** checkboxes; DataTable (Client Name, CL Number,
  Phone, Credit Limit, Credit Status badge).
- ACTION: **Add Client** · Refresh · Row click → detail · **View details** · row menu **Edit** /
  🔒 **Delete** (`DELETE_CLIENT`) · Pagination.
- IPC: `GET_CLIENTS_PAGINATED`, `DELETE_CLIENT`.

### 8.2 Client Detail (`/clients/:id`) — `ClientDetailPage.tsx`
- ACTIONS (header): **Receive Payment** (`ClientBulkPaymentModal`) · **Balance Statement**
  (`ClientStatementModal`) · **Edit Client** (`ClientEditModal`).
- TABS:
  - **Summary**: Client Information, Credit & Pricing (limit, current credit, terms, enabled/disabled,
    bad-credit/good, taxable), Dates.
  - **Invoices** (`ClientInvoicesTab`): status + date filters; table (Invoice #, Date, Total, Paid,
    Balance, Status); **View**; **Pay** (`RecordPaymentModal`, when balance > 0).
  - **Quotations** (`ClientQuotationsTab`): date filter; table (Quotation #, Date, Expiry, Total); View.
  - **Credit Notes** (`ClientCreditNotesTab`): summary cards (Available Credit, Total Issued); table
    (CR #, Date, Invoice, Total, Remaining, Status); row → credit note.
  - **Payments** (`ClientPaymentsTab`): method + date filters; table (Date, Document, Amount, Method,
    Reference, Notes); **Export/Print** menu (CSV / Excel → `EXPORT_REPORT`; Print / PDF / Preview →
    payment-report print).
- IPC: `GET_CLIENT`, `GET_INVOICES_PAGINATED`, `GET_QUOTATIONS_PAGINATED`,
  `GET_CREDIT_NOTES_BY_CLIENT`, `GET_PAYMENTS_PAGINATED`, `GET_ACTIVE_PAYMENT_METHODS`.

### 8.3 Client create/edit & modals
- **ClientEditorPage** (`/clients/new`): Basic Info, Contact, Address, Credit & Pricing (limit, terms,
  Enable Credit, Bad Credit), Tax & Settings (Taxable), Notes → `CREATE_CLIENT`.
- **ClientEditModal**: same form → `UPDATE_CLIENT`.
- 🔒 **ClientBulkPaymentModal** ("Receive Payment"): amount, method (incl. store credit), reference,
  notes; mode **Automatic (FIFO)** / **Select Invoices**; allocation preview → `PROCESS_CLIENT_BULK_PAYMENT`.
  IPC: `GET_CLIENT_OUTSTANDING_INVOICES`, `GET_ACTIVE_PAYMENT_METHODS`,
  `GET_CLIENT_AVAILABLE_CREDIT_NOTES`, `PROCESS_CLIENT_BULK_PAYMENT`.
- **ClientStatementModal** ("Balance Statement"): period (All Time / Date Range); **Preview** / **Save
  PDF** / **Print** (client-statement print).

---

## 9. Suppliers

### 9.1 Suppliers List (`/suppliers`) — `SuppliersPage.tsx`
- VIEW: search; **Active Only** checkbox; DataTable (Company, Contact, Phone, Email, Status).
- ACTION: **Add Supplier** · Refresh · Row click / **View details** · row menu **Edit** /
  🔒 **Activate**·**Deactivate** (`ACTIVATE_SUPPLIER`/`DEACTIVATE_SUPPLIER`) / 🔒 **Delete** (`DELETE_SUPPLIER`).
- IPC: `GET_SUPPLIERS_PAGINATED`.

### 9.2 Supplier Detail (`/suppliers/:id`) — `SupplierDetailPage.tsx`
- ACTION: Back · **Edit Supplier** (`SupplierEditModal` → `UPDATE_SUPPLIER`).
- TABS:
  - **Summary**: Supplier Information, Contact Information, Address, Credit & Terms (limit, description,
    payment terms, discount %, taxable), Dates.
  - **Receiving** (`SupplierReceivingTab`): date filter; receival groups; per-group **View** /
    **Export** (CSV/Excel → `EXPORT_REPORT`) / **Print / PDF / Preview**.
    IPC: `GET_INVENTORY_RECEIVING_BY_SUPPLIER_ALL`.
  - **Bills** (`SupplierBillsTab`): status + date filters; table (Bill #, Date, Total, Paid, Balance,
    Status); **View** → `/bills/:id`. IPC: `GET_BILLS_BY_SUPPLIER`.
    > Bill creation/payment lives on `/bills/:id` pages, not within Suppliers.
- IPC: `GET_SUPPLIER`.

### 9.3 Supplier create & modals
- **SupplierEditorPage** (`/suppliers/new`): Basic Info, Contact, Email, Address, Credit & Terms
  (terms select: None/Net 30/Net 60/Net 90/COD/CIA), Notes → `CREATE_SUPPLIER`.
- **SupplierEditModal** → `UPDATE_SUPPLIER`.
- **NewSupplierModal**: lightweight inline creation (used from Goods Receival) → `CREATE_SUPPLIER`.

---

## 10. Payments

> No **GCT payment** UI and no **payment-method management (CRUD)** UI exist in the renderer, despite
> the IPC channels being defined. Payment methods are only ever read (`GET_ACTIVE_PAYMENT_METHODS`).

### 10.1 Payments List (`/payments`) — `PaymentsPage.tsx`
- VIEW: title + count badge; filters (search, document-type select Invoice/Credit/Bill, date range);
  DataTable (Date, Type badge, Document link + VOID badge, Payer, Method + Ref, Notes, Amount, actions).
- ACTION: Search · Type filter · Date filter · Clear filters · Document link → source doc ·
  Row click → detail · row menu 🔒 **Void Payment** (opens void modal).
- 🔒 **Void modal**: summary + required reason → `VOID_PAYMENT`.
- IPC: `GET_PAYMENTS_PAGINATED`, `GET_ACTIVE_PAYMENT_METHODS`, `VOID_PAYMENT`, `GET_INVOICE_BY_NUMBER`,
  `GET_CREDIT_NOTE_BY_NUMBER`.

### 10.2 Payment Detail (`/payments/:id`) — `PaymentDetailPage.tsx`
- VIEW: header (Payment #, status VOIDED/type badge); Payment Details; Document Information (invoice /
  credit note links); Reference; Notes; Amount card (currency, created, Processed By link); Quick Actions.
- ACTION: Back · **Print** (payment_receipt) · 🔒 **Void Payment** (when eligible) · document/employee
  links · Quick-action view buttons.
- IPC: `GET_PAYMENT`, `GET_EMPLOYEE`, `VOID_PAYMENT`.

### 10.3 Payment components/modals
- **PaymentHistoryCard** (embedded on invoice views): payment table + totals; credit-note badge;
  row menu 🔒 **Void Payment** → `VOID_PAYMENT`. IPC: `GET_PAYMENTS_BY_INVOICE`.
- **RecordPaymentModal**: amount, method, reference, notes; **Apply Credit Note**; **Pay Full Balance**;
  **Record Payment** → `PROCESS_INVOICE_PAYMENT`.
- **PaymentEntryModal** (Save & Pay, multi-method): repeating entries; **Add Another Payment Method**;
  store-credit support; returns entries to caller (which calls the process IPC).

Other defined-but-unused-in-UI channels: `CREATE_PAYMENT`, `CREATE_BILL_PAYMENT`, `UPDATE_PAYMENT`,
`DELETE_PAYMENT`, `PROCESS_INVOICE_REFUND`, all `*_GCT_PAYMENT`, all `*_PAYMENT_METHOD`.

---

## 11. Employees & Attendance

### 11.1 Employees
- **List** `/employees`, **New** `/employees/new`, **Detail** `/employees/:id`, **Edit**
  `/employees/:id/edit`, 🔒 **Permissions** `/employees/:id/permissions`.
- Detail tabs: **Summary**, **Invoices**, **Quotations**, **Credit Notes**, **Payments**, **Attendance**
  (activity views via `GET_EMPLOYEE_*` channels).
- Actions: View · Create (`CREATE_EMPLOYEE`) · Edit (`UPDATE_EMPLOYEE`) · Delete/Deactivate
  (`DELETE_EMPLOYEE`) · 🔒 **Manage Permissions** (`UPDATE_EMPLOYEE_PERMISSIONS`) · 🔒 **Reset
  password** (`UPDATE_EMPLOYEE_PASSWORD`) · Authenticate / verify PIN / access codes.

### 11.2 Attendance (`/attendance`) — currently a **public** route
- Actions: **Clock In / Out** (`CLOCK_IN(_SHIFT)`, `CLOCK_OUT(_SHIFT)`) · View records · 🔒 **Manage/
  edit attendance & shifts** (`CREATE/UPDATE/DELETE_ATTENDANCE`, `UPDATE_SHIFT`, `DELETE_SHIFT`).

### 11.3 Profile (`/profile`) — password-protected; personal account view/edit.

---

## 12. Reports (`/reports`)

Hub (`ReportsPage`) with 2 reports (each a view gate) + **Export**:
| Report | IPC |
|---|---|
| Sales Summary | `GET_SALES_REPORT` |
| Payment Collection | `GET_PAYMENT_COLLECTION_REPORT` |

Cross-cutting: **Export** (`EXPORT_REPORT`) — data exfiltration, worth its own permission.

---

## 13. Settings (`/settings`) — 6 tabs (all high-privilege)

| Tab | Concern | IPC |
|---|---|---|
| **Database** | connection config, run migrations/seeds | `GET/UPDATE_DATABASE_CONFIG`, `TEST_DATABASE_CONNECTION`, `RUN_MIGRATIONS_AND_SEEDS` |
| **Interface** | UI prefs | system settings |
| **Company** | company info | `SET/UPSERT_SYSTEM_SETTING` |
| **Documents** | doc numbering/templates | system settings |
| **Tax** | tax/GCT rates | `GET_TAX_RATE`, system settings |
| **Storage** | file storage path | `VALIDATE_STORAGE_PATH`, `REINITIALIZE_STORAGE`, `GET_STORAGE_INFO` |

---

## 14. Print (cross-module)

`PRINT_DOCUMENT`, `PRINT_DOCUMENT_PREVIEW`, `PRINT_DOCUMENT_PDF`, `GET_AVAILABLE_PRINTERS`,
`GET_PRINT_SETTINGS`, `PRINT_LOOKUP_TICKET`, `PRINT_RECEIVING_REFERENCE`, `PRINT_CLIENT_STATEMENT`,
`PRINT_PAYMENT_REPORT`. Document types printed: invoice, quotation, credit_note, payment_receipt,
client statement, receiving reference, lookup ticket, part labels.

---

## 15. Consolidated permission-surface summary

| Module | Views/Tabs | Notable / sensitive actions |
|---|---|---|
| Invoices | List (Recent/All), Create/Edit, Detail (Payment History, Credit Notes) | 🔒 Issue, Save & Pay, Process Return, Archive, Bulk Discount, Target Total, Admin Override, Stock Override |
| Quotations | List (Recent/All), Create/Edit, Detail | 🔒 Convert to Invoice, Delete, Archive |
| Credit Notes | List (Recent/All), Detail | 🔒 Archive, (created via Return/Invoice) |
| Inventory | List, Detail (7 tabs), Editor | 🔒 Adjust Stock, Delete, Mass Update, Bulk Stock, Delete Variant/Alternate |
| Goods Receival | Receive Parts, Import review | 🔒 Post Receival, Import |
| Clients | List, Detail (5 tabs), Editor | 🔒 Delete, Bulk Payment, Statement, Export |
| Suppliers | List, Detail (3 tabs), Editor | 🔒 Activate/Deactivate, Delete, Export |
| Payments | List, Detail, History card | 🔒 Void Payment, Record Payment, Export |
| Employees | List, Detail (6 tabs), Editor, Permissions | 🔒 Create/Edit/Delete, Manage Permissions, Reset Password |
| Attendance | Clock in/out, records | 🔒 Manage Attendance/Shifts |
| Reports | 3 reports | 🔒 Export |
| Settings | 6 tabs | 🔒 Database, Tax, Company, Documents, Storage |

---

## 16. Recommended additions to the permission model

The current `src/shared/constants/permissions.ts` is missing codes for entire modules and sensitive
actions. Suggested new categories/codes:

- **Clients**: `VIEW/CREATE/EDIT/DELETE_CLIENT`, `CLIENT_BULK_PAYMENT`, `VIEW_CLIENT_STATEMENT`, `EXPORT_CLIENT_DATA`
- **Suppliers**: `VIEW/CREATE/EDIT/DELETE_SUPPLIER`, `ACTIVATE_SUPPLIER`, `MANAGE_BILLS`
- **Inventory (extend)**: `MASS_UPDATE_INVENTORY`, `BULK_STOCK_UPDATE`, `MANAGE_VARIANTS`,
  `MANAGE_ALTERNATES`, `MANAGE_INVENTORY_IMAGES`, `RECEIVE_GOODS`, `IMPORT_RECEIVAL`
- **Payments (extend)**: `VOID_PAYMENT`, `MANAGE_GCT_PAYMENTS`, `MANAGE_PAYMENT_METHODS`, `REFUND_INVOICE`
- **Credit Notes (extend)**: `DELETE_CREDIT_NOTE`, `PROCESS_RETURN`, `RESTORE_CN_INVENTORY`
- **Reports**: `EXPORT_REPORT` (separate from view)
- **Settings (granular)**: split `MANAGE_SETTINGS` into `MANAGE_DATABASE`, `MANAGE_TAX`,
  `MANAGE_COMPANY`, `MANAGE_STORAGE`
- **🔒 Overrides (new "Overrides" category)**: `ADMIN_OVERRIDE`, `OVERRIDE_NEGATIVE_STOCK`,
  `OVERRIDE_CREDIT_LIMIT`, `OVERRIDE_PRICE` (bulk-discount / target-total). Today these are enforced
  by ad-hoc access-code modals (`AdminOverrideModal`, `StockOverrideModal`) — centralize them.
- **Attendance**: decide whether `/attendance` (clock in/out) stays public while `MANAGE_ATTENDANCE`
  gates edits.

---

## 17. Design decisions to settle before implementation

1. **Enforcement altitude** — scaffolding gates by **route** (frontend) plus a few access-code modals.
   Truly securing actions means also checking permissions in the **IPC/service layer** (main process),
   since IPC channels are the real action surface. Route-only gating is bypassable.
2. **Roles vs. flat permissions** — currently a flat per-employee boolean map (~35 → potentially ~70
   codes). At that count, **role templates** (Admin / Manager / Cashier / Stock Clerk) that expand
   into permission sets are far easier to administer than dozens of per-employee switches.
3. **Action-level vs. page-level granularity** — this inventory lists actions at button granularity
   (e.g. Void Payment, Process Return, Mass Update). Decide which get their own code vs. inherit a
   module-level `MANAGE_*`.
