# Feature Plan: Product Lists (reorder lists)

Persistent, named, shared collections of products used to track **what needs ordering**.
Separate from the ephemeral Marked Items tray. Users can add a product to a list from
anywhere products appear; they pick an existing open list or create a new one (title + note).
Each list is one order cycle (`open → ordered → archived`).

## Decisions (locked)
- **Ownership:** shared visibility; track creator (`createdByEmployeeId` + denormalized `createdByName`).
- **Item fields:** product ref (`sku` + `isVariant`) + per-item `note`. **No** per-item quantity, **no** per-item ordered flag.
- **Lifecycle:** one order cycle per list, tracked by list-level `status`.
- **Tray:** untouched. This is a separate, independent feature.
- **Actions on a list:** Export (reuse generic `EXPORT_REPORT`) + Print; status transitions.

---

## Phase 1 — Data layer

### 1.1 Schema — new file `src/main/database/schema/productLists.ts`
Two tables, mirroring conventions in `invoices.ts` / `documentLineItems.ts`.

```
product_lists
  id            serial pk
  title         varchar(150) notNull
  note          text
  status        varchar(20) notNull default 'open'   -- open | ordered | archived
  created_by_employee_id  integer -> employees.id (onDelete set null)
  created_by_name         varchar(100)               -- denormalized snapshot
  ordered_at    timestamp                            -- stamped when status -> ordered
  created_at    timestamp notNull defaultNow
  updated_at    timestamp notNull defaultNow
  indexes: status, created_by_employee_id
  check: status IN ('open','ordered','archived')

product_list_items
  id            serial pk
  list_id       integer notNull -> product_lists.id (onDelete cascade)
  sku           varchar(50) notNull      -- inventory sku OR variant sku (no FK, like document_line_items)
  is_variant    boolean notNull default false
  description   varchar(200)             -- snapshot for stable display/export
  note          text
  sort_order    integer notNull default 0
  added_at      timestamp notNull defaultNow
  indexes: list_id, sku
  unique(list_id, sku, is_variant)       -- prevents accidental dupes; drives "already on list" feedback
```
Export `ProductList`, `InsertProductList`, `ProductListItem`, `InsertProductListItem`
via `$inferSelect` / `$inferInsert`.

### 1.2 Register schema — `src/main/database/schema/index.ts`
Add `export * from './productLists';` under a new `// Product Lists` section.

### 1.3 Migration
Generate with `drizzle-kit generate` → produces `0019_*.sql`, updates `meta/_journal.json`
and a new snapshot. **Trim the generated SQL to only the two new tables** (per the
"Drizzle generate re-emits manual migrations" memory — the generator re-emits prior manual
migrations; keep only the new `CREATE TABLE` statements). Migrations auto-run on startup via
`runMigrations()` in `src/main/database/index.ts`.

### 1.4 Service — `src/main/services/ProductListService.ts`
`extends BaseService<typeof schema.productLists>`, constructor `super(db, schema.productLists)`
(pattern from `InventoryService`). Methods:
- `findAllWithCounts(status?)` — lists + item count (left join + group by / subquery), newest first.
- `findByIdWithItems(id)` — list header + items ordered by `sortOrder`.
- `searchOpenLists(query, limit=20)` — for the add-to-list picker; `status='open'`, title ILIKE.
- `createList(data)` / `updateList(id, data)` (bump `updatedAt`) / `deleteList(id)`.
- `setStatus(id, status)` — when `→ ordered` stamp `orderedAt`; bump `updatedAt`.
- `addItem(listId, item)` — compute next `sortOrder` (max+1); rely on unique constraint,
  catch dupe → return a typed "already on list" result.
- `createListWithItem(listData, item)` — **transaction**: insert list, then first item. Backs the
  modal's "create new list" path.
- `updateItem(itemId, { note })` / `removeItem(itemId)`.
- `reorderItems(listId, orderedIds)` — set `sortOrder` by index.

### 1.5 Controller — `src/main/controllers/ProductListController.ts`
`extends BaseController<ProductListService>`; one method per service call, each wrapped in
`try/catch` → `wrapSuccess` / `handleError` (pattern from `InventoryController`).

### 1.6 IPC channels — `src/shared/types/ipc.ts`
Add a `// Product list operations` block:
`GET_PRODUCT_LISTS`, `GET_PRODUCT_LIST`, `SEARCH_PRODUCT_LISTS_FOR_SELECT`,
`CREATE_PRODUCT_LIST`, `UPDATE_PRODUCT_LIST`, `DELETE_PRODUCT_LIST`,
`SET_PRODUCT_LIST_STATUS`, `ADD_PRODUCT_LIST_ITEM`, `CREATE_PRODUCT_LIST_WITH_ITEM`,
`UPDATE_PRODUCT_LIST_ITEM`, `REMOVE_PRODUCT_LIST_ITEM`, `REORDER_PRODUCT_LIST_ITEMS`.

### 1.7 Wire handlers — `src/main/ipc/handlers.ts`
- Import `ProductListController`; instantiate `productListService = new ProductListService(db)`
  and `productListController = new ProductListController(productListService)` alongside the others (~L222/L275).
- Register `ipcMain.handle(...)` for each channel in a `// ===== PRODUCT LIST HANDLERS =====` block.

**Preload:** no change — `src/preload.ts` `invoke` is a pass-through over `IpcChannel` (no allowlist).

### 1.8 Permissions
- `src/shared/constants/permissions.ts`: add `'Product Lists'` to `PERMISSION_CATEGORIES`, and codes
  `VIEW_PRODUCT_LISTS`, `MANAGE_PRODUCT_LISTS` (create/edit/add/remove/status), `DELETE_PRODUCT_LIST`.
  (Export is gated by the existing `EXPORT_REPORT` code.)
- `src/renderer/router/permissions.ts`: add to `permissionProtectedRoutes` (specific first):
  `/lists/:id → VIEW_PRODUCT_LISTS`, `/lists → VIEW_PRODUCT_LISTS`.
- Add the new codes to the super-admin / default role seed if roles enumerate codes explicitly
  (check `src/main/database/seed`); note new codes default to allowed for employees with no
  permission map, and `ADMIN` bypasses.

---

## Phase 2 — Add-to-list entry point

### 2.1 Shared types — `src/shared/types/productList.ts`
Plain TS interfaces for renderer use (avoid importing drizzle in renderer):
`ProductListStatus`, `ProductList`, `ProductListItem`, `ProductListWithCount`, `ProductListWithItems`.

### 2.2 Hook — `src/renderer/hooks/useProductLists.ts`
Thin `window.electron.invoke` wrappers: `searchOpenLists`, `addItem`, `createListWithItem`,
`getLists`, `getList`, `updateList`, `setStatus`, `updateItem`, `removeItem`, `reorderItems`, `deleteList`.

### 2.3 `src/renderer/components/lists/AddToListButton.tsx`
`ActionIcon` (`IconListPlus`), mirrors `MarkButton`'s two modes:
- `mode:'variant'` → explicit `{ sku, isVariant, description }`.
- `mode:'item'` → `parentSku`, resolves base variant via `resolveBaseVariant` on click.
Opens `AddToListModal` with the resolved snapshot. `event.stopPropagation()` for table rows.

### 2.4 `src/renderer/components/lists/AddToListModal.tsx`
Mantine modal. `SegmentedControl`: **Add to existing** | **Create new**.
- Existing: searchable `Select` fed by `SEARCH_PRODUCT_LISTS_FOR_SELECT` (open lists, debounced).
- New: `TextInput` title (required) + `Textarea` note.
- Shared: optional per-item `Textarea` note.
- Submit → `ADD_PRODUCT_LIST_ITEM` or `CREATE_PRODUCT_LIST_WITH_ITEM` (passes `useAuth().user.id` +
  `user` name as creator). Success/`already on list`/error via `@mantine/notifications`.

### 2.5 Wire the button in
- `src/renderer/pages/inventory/InventoryListPage.tsx` — add an `AddToListButton` in the actions
  column next to `MarkButton`.
- `src/renderer/pages/inventory/InventoryDetailPage.tsx` — header actions.
- `src/renderer/components/inventory/VariantsTab.tsx` — per-variant row (mode:'variant').

---

## Phase 3 — Lists pages

### 3.1 `src/renderer/pages/lists/ProductListsPage.tsx` (index)
`DataTable` of lists: title, note (truncated), status `Badge`, item count, creator, created date,
row actions (Open, Delete via confirm modal). Status filter `SegmentedControl` (All/Open/Ordered/Archived).
"New list" button (creates empty list, navigates to detail). Gated by `VIEW_PRODUCT_LISTS`;
mutating buttons use `PermissionButton` with `MANAGE_PRODUCT_LISTS`.

### 3.2 `src/renderer/pages/lists/ProductListDetailPage.tsx`
- Header: editable title + note (inline/save), status control with `Mark as ordered` / `Archive`
  (→ `SET_PRODUCT_LIST_STATUS`), creator + dates read-only.
- Items table: `ProductDisplay` per row + editable per-item note, remove, reorder (up/down buttons
  writing `REORDER_PRODUCT_LIST_ITEMS`).
- Add item: `InventorySelect` → `ADD_PRODUCT_LIST_ITEM`.
- Toolbar: **Export** and **Print** (Phase 4).

### 3.3 `src/renderer/pages/lists/index.ts` barrel.

### 3.4 Router + nav
- `src/renderer/router/index.tsx`: add `{ path: 'lists', element: <ProductListsPage/> }` and
  `{ path: 'lists/:id', element: <ProductListDetailPage/> }`.
- `src/renderer/components/layout/Sidebar.tsx`: add a `businessNavItems` entry
  `{ label: 'Order Lists', icon: <IconClipboardList/>, path: '/lists' }` (auto-hidden by `canAccessPath`).

---

## Phase 4 — Export / Print

### 4.1 Export (reuse, no new main code)
Build `columns` (Part #, Description, Note, Added) + `rows` from the list items and call
`IpcChannel.EXPORT_REPORT` (`ExportService.exportReport` is fully generic). Button gated by `EXPORT_REPORT`.
Default `fileName` from list title; `sheetName` = title.

### 4.2 Print
Reuse the print infrastructure like `PRINT_RECEIVING_REFERENCE`: add a `PRINT_PRODUCT_LIST` channel +
a reference-style template (title, note, creator/date, item table). If print templating proves heavy,
v1 fallback = a formatted printable route + `window.print()`. **Confirm scope before building.**

---

## Verification
- Typecheck / build (electron-forge + tsc).
- Manual (via `/run` or `/verify`): add a product to a new list from Inventory; add another to the
  same list from the detail page; open Order Lists → open the list → edit a note, reorder, mark ordered
  (verify `orderedAt` + status badge), export to xlsx, then archive.
- Permissions: confirm nav item + routes hide for an employee lacking `VIEW_PRODUCT_LISTS`.

## Out of scope (v1)
Per-item quantity; per-item ordered checkbox; "save tray as list" bridge; converting a list to an
invoice/PO. All are additive later — quantity is a single nullable column + one input if revisited.

## New files
```
src/main/database/schema/productLists.ts
src/main/database/migrations/0019_*.sql            (generated, trimmed)
src/main/services/ProductListService.ts
src/main/controllers/ProductListController.ts
src/shared/types/productList.ts
src/renderer/hooks/useProductLists.ts
src/renderer/components/lists/AddToListButton.tsx
src/renderer/components/lists/AddToListModal.tsx
src/renderer/pages/lists/ProductListsPage.tsx
src/renderer/pages/lists/ProductListDetailPage.tsx
src/renderer/pages/lists/index.ts
```
## Touched files
```
src/main/database/schema/index.ts
src/main/ipc/handlers.ts
src/shared/types/ipc.ts
src/shared/constants/permissions.ts
src/renderer/router/index.tsx
src/renderer/router/permissions.ts
src/renderer/components/layout/Sidebar.tsx
src/renderer/pages/inventory/InventoryListPage.tsx
src/renderer/pages/inventory/InventoryDetailPage.tsx
src/renderer/components/inventory/VariantsTab.tsx
src/main/database/seed/* (roles seed, if codes are enumerated)
```
