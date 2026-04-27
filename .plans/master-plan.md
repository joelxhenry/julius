# Master Plan

This file describes three parallel work streams: **Part A** (rename "SKU" → "Part Number" in the UI), **Part B** (Marked-Items Tray), and **Part C** (Inventory Management section on the System Dashboard). Each is broken into phases with stable ids that the [`/execute`](../.claude/commands/execute.md) slash command can target.

---

## How to execute this plan

Run **`/execute <Phase id>`** — e.g. `/execute Phase A-1`, `/execute Phase B-3`. The command will:

1. Locate the heading `## Phase <id> — <title>` in this file.
2. Read its **Inputs**, **In scope**, **Out of scope**, **Steps**, **Definition of done**, and **Blocking questions** blocks.
3. If any blocking question is still listed in **Open Questions** without a recorded answer, surface them and stop.
4. Otherwise build a TodoWrite list from **Steps**, implement under the grounding rules in [`/execute`](../.claude/commands/execute.md), and verify against **Definition of done**.

When you (the user) answer an open question, append the answer inline under the question and remove it from the **Blocking questions** list of any phase it gated. That is the unambiguous signal to the executor that the phase is now ready.

---

## Phase status

| Phase | Title | Status | Blocking questions |
|---|---|---|---|
| A-0 | Decisions (Part A) | open | Q-A1, Q-A2, Q-A3, Q-A4, Q-A5 |
| A-1 | Audit visible strings | ready | — |
| A-2 | Apply renames | blocked | Q-A1, Q-A2 (Q-A3 if print templates included) |
| A-3 | Verify Part A | depends on A-2 | — |
| B-0 | Decisions (Part B) | open | Q-B1, Q-B2, Q-B3, Q-B4 |
| B-1 | Tray store | blocked | Q-B1, Q-B2, Q-B4 |
| B-2 | Tray UI skeleton | blocked | Q-B3 (depends on B-1) |
| B-3 | Mark buttons | depends on B-2 | — |
| B-4 | Document integration | blocked | Q-B6, Q-B7, Q-B8 (depends on B-3) |
| B-5 | Polish | depends on B-4 | Q-B9 |
| B-6 | Verify Part B | depends on B-5 | — |
| C-0 | Decisions (Part C) | open | Q-C1, Q-C2, Q-C3, Q-C4, Q-C5, Q-C6 |
| C-1 | Dashboard tile + landing page | blocked | Q-C1, Q-C2 |
| C-2 | Quick-add inventory flow | blocked | Q-C3 (depends on C-1) |
| C-3 | Stock adjustment (single + multi-row) | blocked | Q-C4 (depends on C-1) |
| C-4 | Receive new stock from suppliers | blocked | Q-C5 (depends on C-1) |
| C-5 | Mass updates (CSV import / grid edit) | blocked | Q-C6 (depends on C-1) |
| C-6 | Verify Part C | depends on C-5 | — |

> Status terms: **open** = decision phase, no code yet. **ready** = no questions block it. **blocked** = at least one question must be answered first. **depends on X** = X must be complete (no separate questions).

---

# Part A — Rename "SKU" → "Part Number" (User-Facing Only)

## Goal (Part A)
Replace the user-visible term **"SKU"** with **"Part Number"** everywhere it appears in the rendered UI — labels, placeholders, validation messages, table headers, tooltips, toast copy, and printed output. The change is **strictly cosmetic / language-level**.

## Global scope (Part A)

**IN scope:**
- User-facing strings rendered in the renderer (React components in `src/renderer/`).
- Visible text on print templates that the customer/operator sees on paper output.
- Any user-facing copy in toast/notification/error messages.

**OUT of scope (do not touch):**
- ❌ PostgreSQL schema — `inventory.sku`, `variants.parent_sku`, `variants.variant_sku`, `inventory_categories.sku`, `inventory_transactions.sku`, etc. all stay as-is.
- ❌ Drizzle ORM schema files in [src/main/database/schema/](../src/main/database/schema/).
- ❌ Migration files in [src/main/database/migrations/](../src/main/database/migrations/) — none added, none modified.
- ❌ Shared TypeScript types in [src/shared/types/](../src/shared/types/) — `InventoryItem.sku`, `VariantItem.parentSku`/`variantSku`, `LineItem.sku`, `DocumentLineItemData.sku` keep their field names.
- ❌ IPC channel names in [src/shared/types/ipc.ts](../src/shared/types/ipc.ts) — `GET_INVENTORY_BY_SKU` etc. stay.
- ❌ Backend code in `src/main/` — controllers, services, IPC handlers, seeds keep `sku` field names and method names like `findBySku`, `getBySku`.
- ❌ Internal renderer code: variable names, prop names, hook names, form field keys (`form.values.sku`), Zustand/state keys, component names like `<VariantSku>`, JSDoc comments referring to data structure.
- ❌ Documentation files: `POSTGRES_SCHEMA.md`, `database-schema.json`, `migration-mapping.json`, `plan.md`, `README.md`.
- ❌ Cache keys, log messages, dev-tools strings — anything not seen by an end user.

**Rule of thumb:** if the user reads it on screen or on a printout, change it. If only a developer sees it, leave it alone.

---

## Reference A-R1 — String replacements

Look for these patterns inside JSX, validation schemas, and template strings. Replacement is consistent: `"SKU"` → `"Part Number"`, `"Sku"` → `"Part Number"`, `"sku"` → `"part number"` (case-by-case where it appears in user-visible sentences).

| Pattern | Example before | Example after |
|---|---|---|
| Mantine input `label` | `<TextInput label="SKU" …>` | `<TextInput label="Part Number" …>` |
| `placeholder` | `placeholder="Enter SKU code"` | `placeholder="Enter part number"` |
| Form validation messages | `'SKU is required'` | `'Part Number is required'` |
| Table column headers | `<Table.Th>SKU</Table.Th>` | `<Table.Th>Part Number</Table.Th>` |
| `Text`/`Title`/`Badge` content | `<Text>SKU: {item.sku}</Text>` | `<Text>Part Number: {item.sku}</Text>` |
| Tooltips, alt, aria-label | `aria-label="Copy SKU"` | `aria-label="Copy part number"` |
| Toast / `notifications.show` copy | `` message: `Invalid SKU ${x}` `` | `` message: `Invalid part number ${x}` `` |
| Modal titles / section headings | `title="Find by SKU"` | `title="Find by Part Number"` |
| Print template `<th>` / labels | `<th>SKU</th>` | `<th>Part Number</th>` |
| Empty-state / help text | `"No items match this SKU"` | `"No items match this part number"` |

## Reference A-R2 — Code that does NOT change

```tsx
// ✅ Field names in form state — UNCHANGED
form.getInputProps('sku')
form.values.sku

// ✅ TypeScript field access — UNCHANGED
item.sku
variant.parentSku
variant.variantSku

// ✅ IPC calls — UNCHANGED
window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, { sku })

// ✅ Internal variable names — UNCHANGED
const handleSkuChange = (sku: string) => { … }

// ✅ Component names — UNCHANGED
<VariantSku />, <SkuInput />

// ❌ Only the visible label changes
<TextInput label="Part Number" {...form.getInputProps('sku')} />
//                ^^^^^^^^^^^^                              ^^^
//                CHANGE                                    KEEP
```

---

## Reference A-R3 — Files to audit (renderer + print templates only)

### Pages
- [src/renderer/pages/inventory/InventoryListPage.tsx](../src/renderer/pages/inventory/InventoryListPage.tsx)
- [src/renderer/pages/inventory/InventoryDetailPage.tsx](../src/renderer/pages/inventory/InventoryDetailPage.tsx)
- [src/renderer/pages/inventory/InventoryEditorPage.tsx](../src/renderer/pages/inventory/InventoryEditorPage.tsx)
- [src/renderer/pages/invoices/InvoiceCreatePage.tsx](../src/renderer/pages/invoices/InvoiceCreatePage.tsx)
- [src/renderer/pages/invoices/InvoiceDetailPage.tsx](../src/renderer/pages/invoices/InvoiceDetailPage.tsx)
- [src/renderer/pages/quotations/QuotationCreatePage.tsx](../src/renderer/pages/quotations/QuotationCreatePage.tsx)
- [src/renderer/pages/quotations/QuotationDetailPage.tsx](../src/renderer/pages/quotations/QuotationDetailPage.tsx)
- [src/renderer/pages/credit-notes/CreditNoteDetailPage.tsx](../src/renderer/pages/credit-notes/CreditNoteDetailPage.tsx)

### Inventory components
- [src/renderer/components/inventory/OverviewTab.tsx](../src/renderer/components/inventory/OverviewTab.tsx)
- [src/renderer/components/inventory/VariantsTab.tsx](../src/renderer/components/inventory/VariantsTab.tsx)
- [src/renderer/components/inventory/AlternatesTab.tsx](../src/renderer/components/inventory/AlternatesTab.tsx)
- [src/renderer/components/inventory/GalleryTab.tsx](../src/renderer/components/inventory/GalleryTab.tsx)
- [src/renderer/components/inventory/ReceivingTab.tsx](../src/renderer/components/inventory/ReceivingTab.tsx)
- [src/renderer/components/inventory/TransactionsTab.tsx](../src/renderer/components/inventory/TransactionsTab.tsx)
- [src/renderer/components/inventory/InventoryEditModal.tsx](../src/renderer/components/inventory/InventoryEditModal.tsx)

### Invoice / quotation / credit-note components
- [src/renderer/components/invoices/InvoiceLineItemsTable.tsx](../src/renderer/components/invoices/InvoiceLineItemsTable.tsx)
- [src/renderer/components/invoices/InvoiceLineItemsReadOnly.tsx](../src/renderer/components/invoices/InvoiceLineItemsReadOnly.tsx)
- [src/renderer/components/invoices/VariantSelectorModal.tsx](../src/renderer/components/invoices/VariantSelectorModal.tsx)
- [src/renderer/components/invoices/InventoryWarningModal.tsx](../src/renderer/components/invoices/InventoryWarningModal.tsx)
- [src/renderer/components/invoices/ProcessReturnModal.tsx](../src/renderer/components/invoices/ProcessReturnModal.tsx)
- [src/renderer/components/invoices/CreateCreditNoteModal.tsx](../src/renderer/components/invoices/CreateCreditNoteModal.tsx)
- [src/renderer/components/invoices/FloatingAlerts.tsx](../src/renderer/components/invoices/FloatingAlerts.tsx)

### Forms, selects, common
- [src/renderer/components/forms/VariantForm.tsx](../src/renderer/components/forms/VariantForm.tsx)
- [src/renderer/components/forms/AlternateForm.tsx](../src/renderer/components/forms/AlternateForm.tsx)
- [src/renderer/components/selects/InventorySelect.tsx](../src/renderer/components/selects/InventorySelect.tsx)
- [src/renderer/components/selects/VariantSelect.tsx](../src/renderer/components/selects/VariantSelect.tsx)
- [src/renderer/components/common/Spotlight.tsx](../src/renderer/components/common/Spotlight.tsx)
- [src/renderer/components/common/CopyButton.tsx](../src/renderer/components/common/CopyButton.tsx)
- [src/renderer/components/common/LookupTicketButton.tsx](../src/renderer/components/common/LookupTicketButton.tsx)
- [src/renderer/components/common/ProductThumbnail.tsx](../src/renderer/components/common/ProductThumbnail.tsx)
- [src/renderer/components/common/ImageGalleryModal.tsx](../src/renderer/components/common/ImageGalleryModal.tsx)
- [src/renderer/components/common/ImageUploader.tsx](../src/renderer/components/common/ImageUploader.tsx)
- [src/renderer/components/suppliers/SupplierReceivingTab.tsx](../src/renderer/components/suppliers/SupplierReceivingTab.tsx)

### Validation schemas (only the user-facing message strings)
- [src/renderer/utils/schemas.ts](../src/renderer/utils/schemas.ts) — change message strings like `'SKU is required'` → `'Part Number is required'`; **leave field keys (`sku`) alone**.

### Print templates (visible on paper) — included only if Q-A3 = yes
- [src/main/services/print-templates/baseStyles.ts](../src/main/services/print-templates/baseStyles.ts) — only any visible text/labels (CSS class names stay).
- [src/main/services/print-templates/types.ts](../src/main/services/print-templates/types.ts) — visible string constants only.
- [src/main/services/print-templates/thermal/thermalLookupTicketTemplate.ts](../src/main/services/print-templates/thermal/thermalLookupTicketTemplate.ts) — printed labels.
- [src/main/services/print-templates/thermal/thermalBaseStyles.ts](../src/main/services/print-templates/thermal/thermalBaseStyles.ts) — visible labels only.

> Print templates technically live under `src/main/`, but the strings they emit are user-visible — that is the deciding factor.

### Files to skip entirely
- All hooks (`src/renderer/hooks/*`) — internal data plumbing, no user-visible strings.
- `imageCache.ts`, `useInventoryImages`, `useAllInventoryImages` — internal cache keys.
- All `src/main/controllers/`, `src/main/services/` (except print templates above) — backend logic.
- All `src/main/database/` — schema, migrations, seeds.
- All `src/shared/types/` — type definitions.
- `package-lock.json`, `node_modules/`, `out/`.

---

## Phase A-0 — Decisions (Part A)

**Status:** open  
**Blocking questions:** Q-A1, Q-A2, Q-A3, Q-A4, Q-A5

**Steps**
1. Surface each Q-A* to the user.
2. Record the answer inline beneath the question in the **Open Questions (Part A)** section below.
3. Remove answered questions from the *Blocking questions* line of subsequent phases.

**Definition of done**
- Every Q-A* in **Open Questions (Part A)** has a recorded answer (or is explicitly marked "deferred — not needed for A-1/A-2/A-3").

---

## Phase A-1 — Audit visible strings

**Status:** ready (no Q-A* blocks the audit itself)  
**Blocking questions:** —  
**Inputs:** the file lists in Reference A-R3 (excluding §"Files to skip"). Print-template files are included only if Q-A3 = yes.

**In scope**
- Read-only scan: list every `SKU` / `Sku` / `sku` literal in user-visible string contexts inside the listed files.

**Out of scope (additions to global)**
- Do not edit any code in this phase. Audit only.

**Steps**
1. For each file in Reference A-R3, grep within the file for these patterns (string literals only):

   ```
   ">SKU<"          # JSX text node
   "label=\"SKU"   "label=\"Sku"
   "placeholder=\""  (then re-filter for SKU/Sku/sku tokens)
   "title=\""        (then re-filter)
   "aria-label=\""   (then re-filter)
   "message:"        (notifications.show)
   "throw new Error('"
   "'SKU"   "\"SKU"
   ```

2. For each hit, classify: **visible to user → mark for change** vs. **internal → skip**. Reference A-R2 lists the latter pattern.
3. Produce an audit report listing every change A-2 will apply: `file:line` plus before / after.

**Definition of done**
- A written audit report (in this turn's chat or appended to this file under "A-1 Audit Report") covering every file in Reference A-R3 in scope.
- Each entry has a clear classification; ambiguous entries are flagged for the user.

---

## Phase A-2 — Apply renames

**Status:** blocked  
**Blocking questions:** Q-A1, Q-A2 (and Q-A3 if any print-template strings are part of the audit)  
**Inputs:** the audit report from A-1; the answer to Q-A1 (capitalization rule); answer to Q-A2 (abbreviation policy).

**In scope**
- Edit each file flagged by the A-1 report. Use the appropriate capitalization per Q-A1.
- For tight spaces (per Q-A2), substitute "Part No." where the full string would overflow.

**Out of scope (additions to global)**
- Do not change any pattern explicitly listed in Reference A-R2.
- Do not edit files that did not appear in the A-1 audit report. If A-1 missed a file, return to A-1.

**Steps**
1. For each entry in the audit report, apply the agreed replacement.
2. Preserve all surrounding code: form bindings, prop names, variable names, IPC calls, type field access.
3. Where a string concatenates a literal with a value (`` `SKU: ${item.sku}` ``), only the literal token changes.

**Definition of done**
- Every audit entry is resolved (changed or explicitly deferred with a one-line note).
- `tsc --noEmit` passes.
- `npm run lint` passes.
- No unintended diff outside files listed in Reference A-R3.

---

## Phase A-3 — Verify Part A

**Status:** depends on A-2  
**Blocking questions:** —

**Steps**
1. `tsc --noEmit` — must pass.
2. `npm run lint` — must pass.
3. Manual smoke test in the running Electron app, verify "Part Number" appears (and "SKU" no longer appears) in:
   - Inventory list column header and search field placeholder.
   - Inventory detail page (Overview, Variants, Gallery, Alternates, Receiving, Transactions tabs).
   - Inventory editor (create + edit), including variant form.
   - Invoice line items table (header + add-row UI).
   - Quotation create / detail pages.
   - Credit note create / detail.
   - Spotlight search.
   - Print preview of an invoice and a lookup ticket — only if Q-A3 = yes.
   - Validation errors when submitting an inventory form with an empty primary identifier.
4. Final visible-string sweep: re-run the A-1 grep across the renderer; confirm only intentionally-skipped occurrences remain (template-literal expressions referencing `${item.sku}` show the value, but the *literal text* `SKU` is gone from anything the user reads).

**Definition of done**
- All four steps pass. Any deviation is reported back to the user with the specific failing surface.

---

## Risks & mitigations (Part A)

| Risk | Mitigation |
|---|---|
| Accidentally renaming a field key (e.g. `'sku'` in `form.getInputProps('sku')`) and breaking the form binding | Treat the audit as a search-and-decide pass, not a global replace. Inspect each match's context before editing. (Reference A-R2.) |
| Missing a user-visible string | A-3 manual smoke test, plus the final visible-string sweep. |
| Print template change breaking layout (column width, etc.) | "Part Number" is wider than "SKU" — eyeball the print preview, adjust column widths if it overflows on thermal receipts. |
| Inconsistent capitalization | Pick a rule via Q-A1, apply consistently. |
| Validation messages also serve as keys for i18n in future | Not currently using i18n in this project — safe for now. |

---

## Open Questions (Part A)

- **Q-A1 — Capitalization rule.** Confirm: title-case "Part Number" for labels/headings, lowercase "part number" mid-sentence?  
  *Answer:* It should be title case in label/headings and lowercase min sentence

- **Q-A2 — Abbreviation.** For tight spaces (thermal print receipts, narrow table columns), is "Part No." acceptable as a shorter form, or always use the full "Part Number"?  
  *Answer:* use "Part No."

- **Q-A3 — Print templates.** Confirm in-scope (the change appears on customer-facing paper output)?  
  *Answer:* Yes

- **Q-A4 — CopyButton tooltip.** `<CopyButton>` likely shows "Copy SKU" on hover; confirm to change to "Copy part number"?  
  *Answer:* Yes

- **Q-A5 — Anything user-visible outside the renderer** that should be added to Reference A-R3 (e.g. dialog titles set from the main process, OS-level menu items)?  
  *Answer:* Yes

> When you answer one of these, replace `_(unanswered)_` with the answer. Phases that listed the question as blocking become unblocked.

---

# Part B — Marked-Items Tray (Global Selection List)

## Goal (Part B)
Provide a lightweight, in-memory "tray" of inventory items that the user can mark from anywhere in the app (inventory list, detail page, search results, Spotlight, variant rows, alternates) and later consume in bulk by sending the entire selection into a new invoice, quotation, credit note, return, or other document. Once items are consumed by a document action, they are automatically removed from the tray.

Think of it as a clipboard / shopping cart that lives at the application chrome level, independent of the page the user is currently on.

## Behavior requirements (user-facing)

1. **Mark from anywhere** — Any place an inventory item or variant is displayed should expose a "Mark" / "Add to Tray" affordance (icon button, context-menu entry, or keyboard shortcut).
2. **Global access** — A persistent tray launcher (icon + count badge) is visible in the app shell on every route. Clicking it opens the tray panel.
3. **Tray panel** — Lists all currently marked items, shows description, part number, optional quantity field, taxable flag, and unit price. Each row has a remove (×) button.
4. **Bulk actions on the tray:**
   - Add to **new Invoice** → navigate to InvoiceCreatePage with line items prefilled
   - Add to **new Quotation** → navigate to QuotationCreatePage prefilled
   - Add to **new Credit Note** → navigate to credit note flow prefilled
   - Add to **current document** (when user is already on a create/draft page) → append to existing line items
   - **Clear all** → empties the tray (with confirmation)
5. **Auto-remove on consume** — When the tray's items are pushed into a document, they are removed from the tray as soon as the destination page receives them (not waiting for save).
6. **No duplicates** — Marking an item already in the tray is a no-op (or increments quantity — see Q-B4).
7. **Variants vs. base items** — Both inventory items and variants can be marked. The tray stores enough discriminator data (`isVariant`, parent ref) to route correctly.
8. **Volatile** — The list is in-memory only and resets on app reload (default; alternative persistence options listed in Q-B2).

---

## Reference B-R1 — Store shape

```ts
interface MarkedItem {
  // Stable key for dedup — composite of partNumber + isVariant
  key: string;
  partNumber: string;
  description: string;
  unitPrice: number;
  isTaxable: boolean;
  isVariant: boolean;
  parentPartNumber?: string | null;
  inventoryId?: number;
  quantity: number; // default 1
  markedAt: number; // timestamp for sort stability
}

interface MarkedItemsStore {
  items: MarkedItem[];
  count: number; // derived
  mark: (item: Omit<MarkedItem, 'markedAt' | 'quantity'> & { quantity?: number }) => void;
  unmark: (key: string) => void;
  setQuantity: (key: string, qty: number) => void;
  clear: () => void;
  isMarked: (key: string) => boolean;
  consume: () => MarkedItem[]; // returns + clears in one atomic call
}
```

> **Naming alignment with Part A.** Internal store fields use `partNumber` (not `sku`) because they are renderer-side data the executor controls. This is intentionally different from the database column name `sku` — IPC calls into existing controllers still use `{ sku }` parameters. See "Combined notes" at the end.

## Reference B-R2 — UI surfaces

### Tray launcher
- Floating action button or app-shell icon (e.g. shopping-bag icon) with a Mantine `Indicator` showing count.
- Visible on all authenticated routes; placement decided in Q-B3.
- Hidden when count is 0 (or shown grayed-out, TBD).
- Keyboard shortcut to open: see Q-B9.

### Tray panel
- Mantine `Drawer` (right-side) or `Popover` from the launcher. Recommend **Drawer** — gives more room for a table and bulk actions.
- Header: "Marked Items (N)" + Clear All button.
- Body: scrollable list of items with thumbnails (using existing `ProductThumbnail`), description, qty input, remove button.
- Footer: action buttons — "Add to Invoice", "Add to Quotation", "Add to Credit Note". Possibly grouped under a "Send to…" menu.

### Mark affordance
A reusable `<MarkButton item={…} />` component that:
- Reads `isMarked(key)` from the store and toggles state.
- Renders a bookmark/star icon, filled when marked.
- Drops into existing rows: inventory list table, inventory detail header, variant table rows, alternate rows, search results, Spotlight rows.

## Reference B-R3 — Document integration modes

1. **Navigate-and-prefill (no active draft).** Store marked items in a transient param (router state, or a one-shot bucket inside the same Zustand store). Navigate to the create page; the page reads the bucket on mount, calls `consume()`, populates line items.
2. **Append to current draft.** When the user opens the tray while already on a create page, an "Add to current draft" button appends and consumes.

For mode 1, prefer **router state via `navigate('/invoices/new', { state: { fromTray: true } })`** plus the store's `consume()` on mount, rather than encoding items in URL query strings.

## Reference B-R4 — Inventory of affected areas

### New files
- `src/renderer/stores/markedItemsStore.ts` — Zustand store
- `src/renderer/components/tray/MarkedItemsTray.tsx` — drawer panel
- `src/renderer/components/tray/MarkedItemsLauncher.tsx` — header icon + badge
- `src/renderer/components/tray/MarkButton.tsx` — reusable mark/unmark toggle
- `src/renderer/hooks/useMarkedItems.ts` — convenience hook(s) wrapping the store

### Files modified to add Mark affordances
- [src/renderer/pages/inventory/InventoryListPage.tsx](../src/renderer/pages/inventory/InventoryListPage.tsx) — row-level Mark button
- [src/renderer/pages/inventory/InventoryDetailPage.tsx](../src/renderer/pages/inventory/InventoryDetailPage.tsx) — header-level Mark button (item + each variant)
- [src/renderer/components/inventory/VariantsTab.tsx](../src/renderer/components/inventory/VariantsTab.tsx) — per-variant Mark button
- [src/renderer/components/inventory/AlternatesTab.tsx](../src/renderer/components/inventory/AlternatesTab.tsx) — per-alternate Mark button
- [src/renderer/components/selects/InventorySelect.tsx](../src/renderer/components/selects/InventorySelect.tsx) and [VariantSelect.tsx](../src/renderer/components/selects/VariantSelect.tsx) — inline Mark in dropdown rows (optional)
- [src/renderer/components/common/Spotlight.tsx](../src/renderer/components/common/Spotlight.tsx) — Spotlight result row Mark action

### Files modified as consumers
- [src/renderer/pages/invoices/InvoiceCreatePage.tsx](../src/renderer/pages/invoices/InvoiceCreatePage.tsx) — read tray state on mount, prefill line items, call `consume()`
- [src/renderer/pages/quotations/QuotationCreatePage.tsx](../src/renderer/pages/quotations/QuotationCreatePage.tsx) — same pattern
- Credit note create flow (file path TBD during implementation) — same pattern
- App shell layout component ([src/renderer/layouts/AppLayout.tsx](../src/renderer/layouts/AppLayout.tsx)) — mount `<MarkedItemsLauncher />` and `<MarkedItemsTray />`

### No backend changes
Tray is purely renderer-side. **No new IPC channels, controllers, services, or DB tables.** All data needed comes from existing inventory queries already cached in the renderer. (G1 in `/execute` still applies: any IPC call must reference a channel that already exists in `IpcChannel`.)

---

## Phase B-0 — Decisions (Part B)

**Status:** open  
**Blocking questions:** Q-B1, Q-B2, Q-B3, Q-B4

**Steps**
1. Surface Q-B1..Q-B4 to the user (these gate B-1 and B-2).
2. Record answers under **Open Questions (Part B)**.
3. Q-B5..Q-B9 may be deferred to their own gating phase (B-4 or B-5); they do not block B-0.

**Definition of done**
- Q-B1, Q-B2, Q-B3, Q-B4 each have a recorded answer.

---

## Phase B-1 — Tray store

**Status:** blocked  
**Blocking questions:** Q-B1 (state lib), Q-B2 (persistence), Q-B4 (duplicate-mark behavior)  
**Inputs:** Reference B-R1.

**In scope**
- Create the Zustand store at `src/renderer/stores/markedItemsStore.ts` (assuming Q-B1 = Zustand).
- Implement `mark`, `unmark`, `setQuantity`, `clear`, `isMarked`, `consume` per Reference B-R1.
- `mark` honors Q-B4: either no-op on duplicates, or increment quantity.
- If Q-B2 = mirror to `sessionStorage`, wire that mirror; otherwise pure in-memory.
- Add `src/renderer/hooks/useMarkedItems.ts` thin wrapper if helpful for ergonomics.

**Out of scope (additions to global)**
- No UI yet.
- No router integration.
- No IPC.

**Steps**
1. Add `zustand` dependency only if not already installed (do not touch other dependencies). If introducing it, ask the user before running `npm install`.
2. Implement the store and types verbatim from Reference B-R1, with the field-naming alignment note honored (`partNumber` in renderer, never invented IPC).
3. Smoke-test via dev tools or a temporary debug button.

**Definition of done**
- Store actions match Reference B-R1.
- A manual exercise (mark / unmark / setQuantity / consume / clear) works in dev tools.
- `npm run lint` passes.

---

## Phase B-2 — Tray UI skeleton

**Status:** blocked  
**Blocking questions:** Q-B3 (launcher placement)  
**Depends on:** B-1.

**In scope**
- `MarkedItemsLauncher` icon + Mantine `Indicator` badge bound to store count.
- `MarkedItemsTray` Drawer with empty state and non-empty list (no per-row qty controls or bulk actions yet).
- Mount both in `AppLayout` per Q-B3.

**Out of scope (additions to global)**
- No mark buttons in domain pages yet (that is B-3).
- No document integration (that is B-4).
- No keyboard shortcut yet (that is B-5).

**Steps**
1. Build the launcher; subscribe to a `count` selector to avoid re-render storms (see Risks).
2. Build the drawer; show fake entries pushed via dev tools to verify wiring.
3. Mount in `AppLayout` next to the existing Spotlight launcher (or floating per Q-B3).

**Definition of done**
- Launcher visible on every authenticated route.
- Drawer opens/closes; empty and non-empty states render.
- `npm run lint` passes.

---

## Phase B-3 — Mark buttons in domain pages

**Status:** depends on B-2  
**Blocking questions:** —

**In scope**
- Build `<MarkButton item={…} />` (Reference B-R2).
- Wire into the surfaces listed in Reference B-R4 §"Files modified to add Mark affordances".

**Out of scope (additions to global)**
- Don't change any unrelated row layout. The button should be additive, not a redesign.

**Steps**
1. Build `MarkButton`. Read `isMarked(key)`; render filled/outline icon accordingly.
2. Wire in InventoryListPage rows.
3. Wire in InventoryDetailPage header + VariantsTab rows.
4. Wire in AlternatesTab rows.
5. Wire in Spotlight rows.
6. Optional: InventorySelect / VariantSelect dropdown rows (defer if it complicates dropdown layout).

**Definition of done**
- Marking an item from each surface in steps 2-5 is reflected in the launcher count and drawer list.
- `npm run lint` passes.

---

## Phase B-4 — Document integration

**Status:** blocked  
**Blocking questions:** Q-B6 (re-fetch on consume?), Q-B7 (which document targets in MVP), Q-B8 (Append-to-current-draft in MVP?)  
**Depends on:** B-3.

**In scope**
- Tray footer action buttons for the document targets in Q-B7.
- Navigate-and-prefill via router state (`{ fromTray: true }`); destination page reads store and calls `consume()` on mount.
- "Append to current draft" only if Q-B8 = yes.

**Out of scope (additions to global)**
- Do not introduce new IPC channels. Re-fetch on consume (Q-B6) uses existing `GET_INVENTORY_BY_SKU` / `GET_INVENTORY_ITEM` channels.

**Steps**
1. Add the action buttons in the drawer footer for the agreed targets.
2. In each target's create page, on mount: if `location.state?.fromTray` is true, call `consume()`, optionally re-fetch each item per Q-B6, and seed line items.
3. If Q-B8 = yes, add an "Add to current draft" button visible only when the current route matches a create page; wire via a small page-registered callback or pub/sub.

**Definition of done**
- Mark items, hit "Add to Invoice" → InvoiceCreatePage opens with line items pre-populated and the tray is empty.
- Same for each other document target named in Q-B7.
- If Q-B8 = yes, "Add to current draft" appends to the open draft and empties the tray.
- `npm run lint` passes.

---

## Phase B-5 — Polish

**Status:** depends on B-4  
**Blocking questions:** Q-B9 (keyboard shortcut)

**In scope**
- Empty state copy.
- Confirm-modal on Clear All (Mantine `modals.openConfirmModal`).
- Per-row qty input.
- Keyboard shortcut to open tray (per Q-B9).
- Mantine notifications on action completion ("3 items added to invoice").

**Out of scope (additions to global)**
- No persistence-mirror work (defer until Q-B2 is revisited).
- No saved/named selections.

**Steps**
1. Empty-state copy: "No items marked yet — mark items from the inventory list to get started."
2. Confirm modal on Clear All.
3. Qty inputs in tray rows; bind to `setQuantity`.
4. Register keyboard shortcut via the existing `KeyboardShortcutContext` pattern used in `AppLayout`.
5. `notifications.show(...)` on Add-to-X / Clear / Append actions.

**Definition of done**
- Each polish item visibly works.
- `npm run lint` passes.

---

## Phase B-6 — Verify Part B

**Status:** depends on B-5  
**Blocking questions:** —

**Steps**
1. Mark items from each surface (list, detail, variant, alternate, Spotlight).
2. Open tray, verify count and contents.
3. Adjust quantity, remove a row, Clear All (confirm cancels and accepts).
4. Add to new invoice → verify line items pre-populated and tray emptied.
5. Mark items, navigate around app (no reload) — tray persists across routes.
6. Reload app — tray is empty (or restored if Q-B2 = sessionStorage mirror).
7. Test "Append to current draft" while on an existing create page (only if Q-B8 = yes).
8. Verify no regression on inventory list/detail performance with badge subscription active.

**Definition of done**
- All eight steps pass. Any deviation is reported back to the user with the specific failing surface.

---

## Risks & mitigations (Part B)

| Risk | Mitigation |
|---|---|
| Re-render storms when count badge subscribes to whole store | Subscribe to a selector (`store.count`) only — Zustand handles this natively |
| Items in tray become stale (price/qty changed in DB after marking) | On consume, re-fetch current price/qty from inventory before populating line items, rather than trusting cached values (see Q-B6) |
| User marks an item, then deletes it from inventory, then opens tray | On consume, validate items still exist; show a warning toast and skip removed items |
| "Append to current draft" couples tray to specific page state | Use a tiny pub/sub or page-registered callback in the tray; keep coupling thin and well-typed |
| Tray launcher conflicts with existing app-shell elements | Coordinate placement via Q-B3 |
| Mark button visual noise on dense inventory list | Use a subtle outline icon; only fill on marked state |
| Blocked by Part A's rename | Part B can be built in parallel; just use whichever naming Part A finalizes (`partNumber` recommended) |

## Out of scope (Part B)

- Persisting the tray across app restarts (sessionStorage/localStorage mirror) — re-evaluate after MVP.
- Sharing the tray between terminals on the LAN (would require backend storage).
- Editing line-item-level fields (discount, custom price) inside the tray — keep that in the document create pages.
- Tray-level pricing/totals preview — out of scope; users see totals on the destination document.
- Saved/named selections ("save this tray as a template") — out of scope.

---

## Open Questions (Part B)

- **Q-B1 — State library.** Introduce Zustand for this, or use React Context, or another lib already in use?  
  *Answer:* _Ise react context_

- **Q-B2 — Persistence.** Pure in-memory only (matches "temporary"), or also mirror to `sessionStorage` so a renderer reload preserves the tray?  
  *Answer:* _Mirror the session storage_

- **Q-B3 — Launcher placement.** App header (next to Spotlight) or floating bottom-right FAB?  
  *Answer:* _Use a FAB but also include a shortcut_

- **Q-B4 — Duplicate marking.** No-op (existing behavior unchanged), or increment quantity?  
  *Answer:* _No-op but system should also show a suitable feedback_

- **Q-B5 — Item-level quantity.** Editable in the tray, or fixed at 1 and edited only after adding to the document?  
  *Answer:* _Editable quantity on the tray_

- **Q-B6 — Validation on consume.** Re-fetch current inventory state (price/qty/availability) at consume time, or trust the snapshot taken at mark time?  
  *Answer:* _Re-fetch at consume time_

- **Q-B7 — Document targets.** Which document types must be supported in MVP — Invoice, Quotation, Credit Note, Return? All four, or a subset first?  
  *Answer:* _All four_

- **Q-B8 — "Append to current draft" UX.** Required for MVP, or only support "create new document from tray" initially?  
  *Answer:* _Required_

- **Q-B9 — Keyboard shortcut.** Any preferred binding for opening the tray?  
  *Answer:* _@ or shift + 2_

> When you answer one of these, replace `_(unanswered)_` with the answer. Phases that listed the question as blocking become unblocked.

---

# Part C — Inventory Management Section on System Dashboard

## Goal (Part C)
Add an **Inventory Management** section to the System Dashboard ([src/renderer/pages/dashboard/DashboardPage.tsx](../src/renderer/pages/dashboard/DashboardPage.tsx)) that gives the operator a single launching point for the four high-frequency inventory tasks:

1. **Add inventory items** — create new inventory records (delegates to or wraps the existing [InventoryEditorPage](../src/renderer/pages/inventory/InventoryEditorPage.tsx)).
2. **Update stock** — adjust on-hand quantities for one or many existing items.
3. **Receive new inventory from suppliers** — record incoming stock against a supplier (uses the existing receiving model: [InventoryReceivingController](../src/main/controllers/InventoryReceivingController.ts), [ReceivingTab](../src/renderer/components/inventory/ReceivingTab.tsx), [SupplierReceivingTab](../src/renderer/components/suppliers/SupplierReceivingTab.tsx)).
4. **Mass updates** — bulk-edit price / stock / supplier / category / active-flag for many items at once (CSV import OR spreadsheet-style grid).

The four feature flows must each support a **mass / bulk mode** (per the user's "should support mass updates also" requirement) — multiple items added, stocked, received, or updated in one operation.

## Global scope (Part C)

**IN scope:**
- A new dashboard tile in [DashboardPage.tsx](../src/renderer/pages/dashboard/DashboardPage.tsx) under the title **"Inventory Management"**, navigating to a new landing route (e.g. `/inventory/manage`).
- A new landing page that exposes the four sub-flows (add / update stock / receive / mass update) as cards or tabs.
- New renderer pages and components for each sub-flow's mass-mode UI.
- Use **only existing IPC channels** (Reference C-R3) — no new backend code unless Q-C7 requires it.
- Mantine UI components, consistent with the rest of the app.
- Toast feedback (via `notifications.show`) and confirmation modals (via `modals.openConfirmModal`) on bulk actions.
- Inventory transactions must be created where the existing single-item flows already create them (stock changes, receiving) — i.e. mass operations must produce the same audit trail as single operations.

**OUT of scope:**
- ❌ Database schema changes — no new tables, no new columns.
- ❌ New IPC channels unless Q-C7 forces it. Mass operations should iterate over existing per-item channels (`UPDATE_INVENTORY_STOCK`, `CREATE_INVENTORY_RECEIVING`, `UPDATE_INVENTORY`, `CREATE_INVENTORY`) inside a Promise loop on the renderer.
- ❌ Touching the existing [InventoryListPage](../src/renderer/pages/inventory/InventoryListPage.tsx) / [InventoryEditorPage](../src/renderer/pages/inventory/InventoryEditorPage.tsx) / [InventoryDetailPage](../src/renderer/pages/inventory/InventoryDetailPage.tsx) layouts. They remain unchanged; the new Inventory Management page sits **alongside** them.
- ❌ Reports/analytics — those live in [ReportsPage](../src/renderer/pages/reports/) and are not duplicated here.
- ❌ Variant management at the dashboard level — handled inside the existing inventory editor.
- ❌ Image uploads in mass mode — stays per-item via existing [ImageUploader](../src/renderer/components/common/ImageUploader.tsx).
- ❌ Replacing existing single-item flows. The dashboard section is a **shortcut and a bulk-mode wrapper**, not a rewrite.

**Naming.** All new user-visible strings use "Part Number" / "part number" per the Part A rule. Internal field keys (`sku`, `supplierId`, `quantity`) follow the existing data model.

---

## Reference C-R1 — Existing infrastructure to reuse

| Capability | Renderer entry | IPC channel | Backend method |
|---|---|---|---|
| Create inventory item | [InventoryEditorPage.tsx](../src/renderer/pages/inventory/InventoryEditorPage.tsx) | `CREATE_INVENTORY` | `InventoryController.create` |
| Update inventory item | [InventoryEditorPage.tsx](../src/renderer/pages/inventory/InventoryEditorPage.tsx) | `UPDATE_INVENTORY` | `InventoryController.update` |
| Update on-hand stock only | (no dedicated UI yet) | `UPDATE_INVENTORY_STOCK` | `InventoryController.updateStock` |
| Update price only | (no dedicated UI yet) | `UPDATE_INVENTORY` (via `updatePrice` service) | `InventoryController.updatePrice` |
| Record receiving (supplier → stock) | [ReceivingTab.tsx](../src/renderer/components/inventory/ReceivingTab.tsx), [SupplierReceivingTab.tsx](../src/renderer/components/suppliers/SupplierReceivingTab.tsx) | `CREATE_INVENTORY_RECEIVING` | `InventoryReceivingController.create` |
| List receiving by supplier | [SupplierReceivingTab.tsx](../src/renderer/components/suppliers/SupplierReceivingTab.tsx) | `GET_INVENTORY_RECEIVING_BY_SUPPLIER` | `InventoryReceivingController.getBySupplierIdPaginated` |
| Search inventory | [InventorySelect.tsx](../src/renderer/components/selects/InventorySelect.tsx) | `SEARCH_INVENTORY_FOR_SELECT` | `InventoryController.searchForSelect` |
| List active suppliers | (existing) | `GET_ACTIVE_SUPPLIERS` | `SupplierController.getActive` |

Confirmed via [src/shared/types/ipc.ts](../src/shared/types/ipc.ts) lines 75–98 (inventory), 276–283 (receiving), 34–45 (suppliers).

## Reference C-R2 — Routes and navigation

| Route | Component | Purpose |
|---|---|---|
| `/inventory/manage` | `InventoryManagementPage` (new) | Landing page with four sub-flow tiles or tabs |
| `/inventory/manage/add` | `BulkAddInventoryPage` (new) | Mass-add new inventory items |
| `/inventory/manage/stock` | `BulkStockUpdatePage` (new) | Adjust on-hand stock for many items |
| `/inventory/manage/receive` | `BulkReceivingPage` (new) | Record receiving from one supplier across many items |
| `/inventory/manage/mass-update` | `MassUpdatePage` (new) | CSV import / grid edit for arbitrary fields |

These routes register in [src/renderer/router/index.tsx](../src/renderer/router/index.tsx) and [src/renderer/utils/componentMapper.tsx](../src/renderer/utils/componentMapper.tsx), following the pattern already used for `inventory`, `inventory/new`, `inventory/:id`.

## Reference C-R3 — IPC discipline (G1 from `/execute`)

The mass operations **must not** invent new channels. Each row in a bulk submission triggers one of the existing channels listed in Reference C-R1, awaited in sequence (or `Promise.all` capped at a small concurrency, e.g. 5) on the renderer. The result aggregator collects per-row success/failure and renders a summary modal.

If profiling shows this is too slow for realistic batches (e.g. 500 rows × 30 ms RTT), Q-C7 asks whether to add a single new batch channel; that question only needs an answer if a measured problem appears. Default behavior: iterate.

## Reference C-R4 — Mass-update field whitelist

The MassUpdatePage (C-5) lets the user set the same value across many rows for these fields only:

- `quantityOnHand` (set or delta)
- `unitPrice`
- `costPrice`
- `supplierId`
- `category`
- `model`
- `isActive`
- `lowStockThreshold`

Out of MassUpdate scope: `sku`, `description`, image data, variants, alternates, transaction history. Editing these in bulk is too error-prone — keep them per-item.

## Reference C-R5 — Dashboard tile shape

Insert into the `dashboardSections` array in [DashboardPage.tsx](../src/renderer/pages/dashboard/DashboardPage.tsx):

```tsx
{
  title: 'Inventory Management',
  description: 'Add items, adjust stock, receive from suppliers, and run mass updates',
  icon: <IconPackages size={24} />,
  color: 'orange', // or another not already used by adjacent tiles
  path: '/inventory/manage',
},
```

`IconPackages` is already imported at the top of the file. The placement (between which existing tiles) is decided in Q-C2.

---

## Phase C-0 — Decisions (Part C)

**Status:** open
**Blocking questions:** Q-C1, Q-C2, Q-C3, Q-C4, Q-C5, Q-C6

**Steps**
1. Surface each Q-C* to the user.
2. Record answers inline under **Open Questions (Part C)**.
3. Remove answered questions from the *Blocking questions* line of subsequent phases.

**Definition of done**
- Each Q-C* in **Open Questions (Part C)** has a recorded answer (or is explicitly deferred).

---

## Phase C-1 — Dashboard tile + landing page

**Status:** blocked
**Blocking questions:** Q-C1 (landing layout: cards vs tabs), Q-C2 (tile placement and color)
**Inputs:** Reference C-R5, Reference C-R2.

**In scope**
- Add the dashboard tile per Reference C-R5.
- Create `src/renderer/pages/inventory/InventoryManagementPage.tsx` rendering four navigation cards (or tabs, per Q-C1) for: Add, Update Stock, Receive, Mass Update.
- Register `/inventory/manage` in [router/index.tsx](../src/renderer/router/index.tsx) and [componentMapper.tsx](../src/renderer/utils/componentMapper.tsx).
- Stub the four sub-routes with placeholder pages that say "Coming soon" — they fill in C-2 through C-5.

**Out of scope (additions to global)**
- No business logic yet. Each sub-page is a stub.
- Do not modify existing inventory pages.

**Steps**
1. Append the new section object to `dashboardSections` in [DashboardPage.tsx](../src/renderer/pages/dashboard/DashboardPage.tsx) at the position decided in Q-C2.
2. Create [InventoryManagementPage.tsx](../src/renderer/pages/inventory/InventoryManagementPage.tsx) using Mantine `SimpleGrid` of `Paper` cards (mirror DashboardPage style) or `Tabs`, per Q-C1.
3. Create stub files [BulkAddInventoryPage.tsx](../src/renderer/pages/inventory/BulkAddInventoryPage.tsx), [BulkStockUpdatePage.tsx](../src/renderer/pages/inventory/BulkStockUpdatePage.tsx), [BulkReceivingPage.tsx](../src/renderer/pages/inventory/BulkReceivingPage.tsx), [MassUpdatePage.tsx](../src/renderer/pages/inventory/MassUpdatePage.tsx).
4. Add route entries in [router/index.tsx](../src/renderer/router/index.tsx) and [componentMapper.tsx](../src/renderer/utils/componentMapper.tsx).
5. Export the new pages from [src/renderer/pages/inventory/index.ts](../src/renderer/pages/inventory/index.ts).

**Definition of done**
- Dashboard shows the new tile; clicking it navigates to `/inventory/manage`.
- Landing page shows four navigable cards/tabs.
- Each sub-route renders a placeholder.
- `tsc --noEmit` and `npm run lint` pass.

---

## Phase C-2 — Quick-add inventory flow

**Status:** blocked
**Blocking questions:** Q-C3 (single quick-form vs spreadsheet-style multi-row)
**Depends on:** C-1.
**Inputs:** Reference C-R1, Reference C-R3, schema [src/main/database/schema/](../src/main/database/schema/).

**In scope**
- Build out [BulkAddInventoryPage.tsx](../src/renderer/pages/inventory/BulkAddInventoryPage.tsx).
- If Q-C3 = single quick-form: a streamlined form with only the required fields (sku, description, unitPrice, costPrice, supplierId, quantityOnHand) and a "Save and add another" button that resets the form.
- If Q-C3 = multi-row: a Mantine `Table` with editable cells; "Add row" button; "Save all" button submits each row via `CREATE_INVENTORY` (Reference C-R3 iteration).
- Validation per row (reuse rules from [schemas.ts](../src/renderer/utils/schemas.ts)).
- Result summary modal after submit: N created / M failed, with the failed rows kept on screen for correction.

**Out of scope (additions to global)**
- No image uploads in this view. (Mass image upload is out of scope per global.)
- No variants / alternates in this view.

**Steps**
1. Build the form/table per Q-C3 using Mantine and existing form helpers.
2. Wire `CREATE_INVENTORY` calls; collect per-row outcomes.
3. Render the summary modal; preserve unsaved/failed rows for retry.
4. Add `notifications.show` on overall outcome.

**Definition of done**
- The page allows adding ≥1 inventory item end-to-end with success feedback.
- Mass-mode (if Q-C3 = multi-row) handles a 20-row submission with per-row error reporting.
- `tsc --noEmit` and `npm run lint` pass.
- Created items appear on [InventoryListPage](../src/renderer/pages/inventory/InventoryListPage.tsx).

---

## Phase C-3 — Stock adjustment (single + multi-row)

**Status:** blocked
**Blocking questions:** Q-C4 (set absolute vs delta; require reason / transaction note?)
**Depends on:** C-1.
**Inputs:** Reference C-R1 (`UPDATE_INVENTORY_STOCK`), [InventoryTransactionController.ts](../src/main/controllers/InventoryTransactionController.ts) for the audit-trail follow-through.

**In scope**
- Build [BulkStockUpdatePage.tsx](../src/renderer/pages/inventory/BulkStockUpdatePage.tsx).
- A search/picker (using [InventorySelect](../src/renderer/components/selects/InventorySelect.tsx)) to add rows to a working list.
- Each row: current qty (read-only), new qty input or delta input (per Q-C4), optional reason/note.
- "Apply changes" button submits each row through `UPDATE_INVENTORY_STOCK`.
- If Q-C4 says note is required, also create an `INVENTORY_TRANSACTION` per row using `CREATE_INVENTORY_TRANSACTION`.
- Confirmation modal listing what will change before submission.

**Out of scope (additions to global)**
- No price changes here (that's Mass Update, C-5).
- No supplier link (that's Receiving, C-4).

**Steps**
1. Build the working-list table.
2. Wire current-qty fetch via existing item search/get.
3. Build the confirm modal showing diffs.
4. On confirm, iterate `UPDATE_INVENTORY_STOCK` (and `CREATE_INVENTORY_TRANSACTION` if applicable).
5. Show summary; refetch updated rows so the table reflects new state.

**Definition of done**
- Adjusting one item updates `quantityOnHand` on the inventory record.
- Adjusting ten items in one batch updates all ten and reports any failures individually.
- An InventoryTransaction is created if Q-C4 requires it (and not otherwise).
- `tsc --noEmit` and `npm run lint` pass.

---

## Phase C-4 — Receive new stock from suppliers

**Status:** blocked
**Blocking questions:** Q-C5 (receiving header model: one supplier per session vs mixed; capture invoice/PO number?)
**Depends on:** C-1.
**Inputs:** Reference C-R1 (`CREATE_INVENTORY_RECEIVING`), schema for `inventory_receiving`, existing [SupplierReceivingTab.tsx](../src/renderer/components/suppliers/SupplierReceivingTab.tsx) as UX reference.

**In scope**
- Build [BulkReceivingPage.tsx](../src/renderer/pages/inventory/BulkReceivingPage.tsx).
- Step 1: select a supplier (`GET_ACTIVE_SUPPLIERS`).
- Step 2: optionally capture session-level metadata per Q-C5 (PO number, supplier invoice ref, received date).
- Step 3: add rows. Each row picks an existing inventory item (or, if Q-C5 = allow new, opens a thin "create on the fly" flow that calls `CREATE_INVENTORY` first), with quantity received and unit cost.
- Submit: iterate `CREATE_INVENTORY_RECEIVING` per row. Each receiving record automatically increments stock via the existing service (verify behavior in [InventoryReceivingService](../src/main/services/InventoryReceivingService.ts) before relying on it — if it doesn't already, follow up with `UPDATE_INVENTORY_STOCK` per row, in the same way the existing single-row UI does).
- Summary modal with per-row outcome.

**Out of scope (additions to global)**
- No editing of receiving records here (existing detail flow handles edits).
- No partial-receipt against a PO model — there is no PO entity to bind to in the current schema. Just header metadata fields.

**Steps**
1. Build supplier selector + session metadata header.
2. Build receiving rows table with item search (`SEARCH_INVENTORY_FOR_SELECT`).
3. Submit loop using `CREATE_INVENTORY_RECEIVING`. Verify in code whether stock is updated automatically; if not, also call `UPDATE_INVENTORY_STOCK`.
4. Summary modal; on success, offer "Receive another batch" that resets rows but keeps supplier+date.

**Definition of done**
- Recording receipt of 5 different items from one supplier produces 5 inventory_receiving rows and increments stock by the correct quantities.
- Receipts show up on the supplier's [SupplierReceivingTab](../src/renderer/components/suppliers/SupplierReceivingTab.tsx).
- `tsc --noEmit` and `npm run lint` pass.

---

## Phase C-5 — Mass updates (CSV import / grid edit)

**Status:** blocked
**Blocking questions:** Q-C6 (CSV import vs in-app grid vs both; max batch size; dry-run preview?)
**Depends on:** C-1.
**Inputs:** Reference C-R4 (field whitelist), Reference C-R3.

**In scope**
- Build [MassUpdatePage.tsx](../src/renderer/pages/inventory/MassUpdatePage.tsx).
- **If Q-C6 includes CSV import:** an upload control accepting a CSV with columns from Reference C-R4. Parse client-side (e.g. `papaparse` if already in deps; otherwise propose adding it under a separate question). Validate each row against the whitelist; show a preview table with errors highlighted; require explicit "Apply" click after preview.
- **If Q-C6 includes grid edit:** a Mantine `Table` populated from a search/filter (e.g. by supplier or category), with editable cells limited to Reference C-R4 fields. "Save changes" diffs against original and submits only changed cells.
- Submit: each changed item → one `UPDATE_INVENTORY` call (or `UPDATE_INVENTORY_STOCK` if only `quantityOnHand` changed). Iterate per Reference C-R3.
- Two-step confirm: preview screen, then summary screen.
- For `quantityOnHand` changes that go through `UPDATE_INVENTORY_STOCK`, ensure the same audit-trail behavior as Phase C-3 (Q-C4 may apply here too).

**Out of scope (additions to global)**
- No editing of fields outside Reference C-R4.
- No image / variant / alternate edits.
- No async background jobs — operation is synchronous on the renderer with progress UI.

**Steps**
1. Implement the chosen import/edit mode(s) per Q-C6.
2. Build a preview/diff view that surfaces validation errors and per-row impact.
3. Submit loop with progress indicator (e.g. Mantine `Progress` showing N of M).
4. Summary modal with successes and a downloadable error CSV (if CSV mode) for failed rows.

**Definition of done**
- Importing a 50-row CSV applies all valid rows and reports invalid ones without applying them.
- Editing 10 cells in the grid mode submits exactly the changed cells and reflects new values on refresh.
- Audit trail consistency for stock changes matches Phase C-3.
- `tsc --noEmit` and `npm run lint` pass.

---

## Phase C-6 — Verify Part C

**Status:** depends on C-5
**Blocking questions:** —

**Steps**
1. `tsc --noEmit` — must pass.
2. `npm run lint` — must pass.
3. Smoke test in the running Electron app:
   - Dashboard tile is visible and routes to `/inventory/manage`.
   - Landing page renders four sub-flows.
   - Add (single + bulk if applicable) creates items and they appear on InventoryListPage.
   - Stock update (single + bulk) adjusts `quantityOnHand` and creates audit transactions per Q-C4.
   - Receiving (single + bulk) creates inventory_receiving records visible from the supplier's tab and the inventory item's [ReceivingTab](../src/renderer/components/inventory/ReceivingTab.tsx).
   - Mass update applies whitelisted changes and rejects non-whitelisted columns.
4. Failure modes:
   - Submit a batch with one invalid row → other rows still apply, the bad row is reported.
   - Cancel from a confirm modal → no writes happen.
5. Naming sweep: verify all new user-visible strings use "Part Number" / "part number" per Part A.

**Definition of done**
- All five steps pass. Any deviation reported with the specific failing surface.

---

## Risks & mitigations (Part C)

| Risk | Mitigation |
|---|---|
| Looping IPC calls is slow for large batches | Cap concurrency (e.g. 5 in-flight); show progress; if measurably too slow, escalate Q-C7 for a batch channel |
| Partial failure in a multi-row submit leaves the user uncertain about state | Per-row outcome summary with retry path; refetch affected rows after submit |
| Users edit fields outside the safe whitelist (description, sku) and corrupt records | Hard-enforce Reference C-R4 in the UI; ignore unknown CSV columns with a warning |
| Stock changes via mass update bypass the inventory_transactions audit trail | Mirror the existing single-row stock flow's transaction creation; gate via Q-C4 |
| Receiving doesn't auto-increment stock and we forget to follow up with `UPDATE_INVENTORY_STOCK` | First task in C-4 step 3 is to **read** [InventoryReceivingService](../src/main/services/InventoryReceivingService.ts) and verify the behavior before coding |
| New routes conflict with existing `inventory/:id` (e.g. `inventory/manage` could be parsed as id=manage) | Confirm router order in [router/index.tsx](../src/renderer/router/index.tsx) — static `inventory/manage` path must be registered before the dynamic `inventory/:id` route, or use a non-numeric guard. Verify in C-1 |
| Tile placement makes dashboard feel cluttered | Decide via Q-C2; consider grouping inventory + reports visually |
| CSV parsing pulls in a new dependency (papaparse) | Q-C6 surfaces the dependency choice; if not already in deps, ask before installing |

## Out of scope (Part C)

- Schema or backend changes (covered by global out-of-scope).
- New IPC channels (covered by Reference C-R3 / Q-C7).
- Background/async jobs for large batches.
- Mass image upload, variant management, alternate management.
- Reporting and analytics — those belong in [ReportsPage](../src/renderer/pages/reports/).
- Mobile-responsive layout for the new pages — desktop-first matches the rest of the app.

---

## Open Questions (Part C)

- **Q-C1 — Landing-page layout.** Cards (matching the System Dashboard style) or tabs inside one page?
  *Answer:* _(unanswered)_

- **Q-C2 — Tile placement and color.** Where should the new tile sit in `dashboardSections` (next to Reports? next to System Settings? first?), and what Mantine color (the example uses `orange`)?
  *Answer:* _(unanswered)_

- **Q-C3 — Add-mode shape.** Single quick-form with "save and add another", or a multi-row spreadsheet-style table from the start, or both (toggle)?
  *Answer:* _(unanswered)_

- **Q-C4 — Stock adjustment semantics.** Set absolute new qty vs apply a delta (+5 / −2)? Is a reason / note required, and should an `inventory_transaction` row be created for each adjustment?
  *Answer:* _(unanswered)_

- **Q-C5 — Receiving session model.** One supplier per receiving session (recommended for clean reporting), or allow mixed-supplier sessions? Capture PO number / supplier invoice ref / received date as session metadata? Allow on-the-fly creation of an inventory item that doesn't yet exist?
  *Answer:* _(unanswered)_

- **Q-C6 — Mass update mechanism.** CSV import only, in-app spreadsheet grid only, or both? Max batch size to allow client-side (e.g. 500 rows)? Require a dry-run preview before applying?
  *Answer:* _(unanswered)_

- **Q-C7 — New batch IPC channel?** Default is no (iterate over existing per-row channels per Reference C-R3). Re-open only if measured performance is unacceptable. If yes, name and shape of the new channel.
  *Answer:* _(unanswered, deferred unless C-2/C-3/C-4/C-5 surface a real performance issue)_

> When you answer one of these, replace `_(unanswered)_` with the answer. Phases that listed the question as blocking become unblocked.

---

# Combined notes

All three work streams can run in parallel.

**Naming alignment between Part A and Part B.** Because Part A is strictly user-facing language (no DB / type / IPC / code-identifier changes), Part B's **internal code** (database column references, IPC parameters) keeps using `sku` / `parentSku` / `variantSku` to match the existing data model. Part B's renderer-only types (the store interface) use `partNumber` because that lives entirely in the renderer's local language. Part B's **rendered UI strings** (labels in the tray panel, the Mark button tooltip "Mark this part number", action button text, empty-state copy, notification text) use "Part Number" / "part number" per the Part A capitalization rule.

**Naming alignment for Part C.** Same rule. New renderer pages use existing field names (`sku`, `supplierId`, `quantityOnHand`) for code-level identifiers and variables, and "Part Number" / "part number" for any rendered string the user sees on the dashboard, sub-flow pages, confirm modals, and toast messages. CSV column headers in Mass Update should use the user-facing names ("Part Number", "Unit Price") and map to internal field keys on import.

**Order of execution.** Part C's C-1 only touches the dashboard and adds stub routes — it can land before Part A finishes, because the new tile string can be authored "Part Number"-aware from day one. C-2 through C-5 build out the bulk flows and don't conflict with Part A's rename pass or Part B's tray. Wire the Mark affordance from Part B into Bulk Stock Update / Bulk Receiving once both streams are in (post Phase B-3 and Phase C-3), so a user can mark items elsewhere and pull them into the bulk forms.

If the executor encounters an inconsistency between this plan and the actual codebase, codebase wins (per `/execute` rule G10) — flag it back to the user.
