# Master Plan

This file describes two parallel work streams: **Part A** (rename "SKU" → "Part Number" in the UI) and **Part B** (Marked-Items Tray). Each is broken into phases with stable ids that the [`/execute`](../.claude/commands/execute.md) slash command can target.

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

# Combined notes

Both work streams can run in parallel.

**Naming alignment between Part A and Part B.** Because Part A is strictly user-facing language (no DB / type / IPC / code-identifier changes), Part B's **internal code** (database column references, IPC parameters) keeps using `sku` / `parentSku` / `variantSku` to match the existing data model. Part B's renderer-only types (the store interface) use `partNumber` because that lives entirely in the renderer's local language. Part B's **rendered UI strings** (labels in the tray panel, the Mark button tooltip "Mark this part number", action button text, empty-state copy, notification text) use "Part Number" / "part number" per the Part A capitalization rule.

If the executor encounters an inconsistency between this plan and the actual codebase, codebase wins (per `/execute` rule G10) — flag it back to the user.
