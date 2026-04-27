---
description: Execute a phase or task from .plans/master-plan.md, grounded in this codebase's actual patterns
argument-hint: <phase id or task description, e.g. "Phase B-1" or "rename SKU labels in invoice components">
---

# /execute — implement a planned phase or task

You are about to implement the following from the master plan:

**TARGET:** $ARGUMENTS

The master plan lives at [.plans/master-plan.md](.plans/master-plan.md). Read the section that matches the target above (match by phase id like `Phase B-1`, by section heading, or by best-fit description). If no clear match exists, **stop and ask the user which section they meant** — do not guess.

---

## How to run this command

1. **Read the plan section** for the target. Note its scope, "in/out of scope" lists, files to touch, and any open questions that block work.
2. **If the plan has unresolved open questions covering the target**, surface them and ask the user before writing code. Do not invent answers.
3. **Build a TodoWrite list** of the concrete edits implied by the plan section (one todo per file or coherent change). Mark each one done as you finish it — don't batch.
4. **Implement strictly within the plan's scope.** Do not refactor, rename, or "improve" things not called out by the plan. If you find something tangential that looks broken, leave a single-sentence note for the user; do not fix it under cover of this task.
5. **Verify** at the end: run `npm run lint` and (if the project gains a typecheck script) `tsc --noEmit`. Report the results. Do a manual walk-through of the user-facing surfaces the plan section names. If you cannot run the UI, say so explicitly — do not claim a feature works without seeing it.

---

## Grounding rules — non-negotiable, to prevent hallucinations and broken code

These rules are what this codebase actually does. **Verify before you invent.** If a rule below conflicts with what you remember from another project, this codebase wins.

### G1. Never invoke an IPC channel you haven't seen in `IpcChannel`
- The enum lives at [src/shared/types/ipc.ts](src/shared/types/ipc.ts).
- Before calling `window.electron.invoke(IpcChannel.X, ...)`, **grep for `X` in `ipc.ts`**. If it isn't there, you must add it AND register a handler in [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts) AND implement the controller method. All three or none.
- Channel naming: `db:kebab-case` (e.g. `'db:get-inventory-paginated'`). Match the existing style for any new channel.
- Renderer responses are always `{ success: boolean; data?: T; error?: string }`. Always check `result.success` before reading `result.data`.

### G2. Backend layering: Controller → Service → Drizzle. No shortcuts.
- Controllers (in [src/main/controllers/](src/main/controllers/)) extend `BaseController` and wrap calls with `this.wrapSuccess(...)` / `this.handleError(error)`. Don't return raw objects; don't `throw` upward.
- Services (in [src/main/services/](src/main/services/)) own all DB access. Use Drizzle (`eq`, `and`, `or`, `ilike`, `desc`, `asc`, `count`, `sql`) — **never raw SQL strings**, never a different ORM.
- Schema is in [src/main/database/schema/](src/main/database/schema/) and re-exported by `index.ts`. Import as `import * as schema from '../database/schema'` — don't reach into individual schema files unless the existing file you're editing already does.
- Pagination shape across services: `{ data, total, page, pageSize, totalPages }`. Match it.

### G3. Don't hand-edit migrations
- Files under [src/main/database/migrations/](src/main/database/migrations/) are produced by Drizzle Kit. If a schema change is needed, edit the schema file in [src/main/database/schema/](src/main/database/schema/) and tell the user to run `npm run db:generate`. **Do not** write `.sql` files directly, do not rename existing migration files, and do not edit a migration after it has been committed.

### G4. JSON-array fields: `category`, `model` (and any other multi-value `varchar`)
- Stored as either a JSON-array string (`'["A","B"]'`) or a legacy single value (`'A'`). Always read with `normalizeToArray(...)` and write with `arrayToJsonString(...)` — both in [src/shared/utils/arrayFields.ts](src/shared/utils/arrayFields.ts).
- For filtering by these columns in SQL, **use `ilike(column, '%value%')`**, not `eq(column, value)` — `eq` will miss every row whose value is stored as a JSON array.

### G5. Renderer: Mantine 8 only
- UI components: `@mantine/core`. Forms: `useForm` from `@mantine/form`. Hooks: `@mantine/hooks` (`useDisclosure`, `useDebouncedValue`). Notifications: `notifications.show(...)` from `@mantine/notifications`.
- **Don't pull in another UI lib.** No Material UI, no Chakra, no Ant. No raw `<button>` when a Mantine `<Button>` will do.
- Colors and spacing: use Mantine CSS variables (`var(--mantine-color-body)`, `var(--mantine-color-default-border)`, `var(--mantine-spacing-md)`, `var(--mantine-radius-md)`) — not hardcoded hex.
- Icons: `@tabler/icons-react`. Pick existing icon names; don't invent.

### G6. Navigation, tabs, permissions
- Don't call `useNavigate()` directly for protected routes. Use the `handleProtectedNavigation` flow already wired in [src/renderer/layouts/AppLayout.tsx](src/renderer/layouts/AppLayout.tsx), or — inside a tabbed page — `replaceCurrentTab(path)` / `openTab(path, component)` from `useTabContext()` in [src/renderer/contexts/TabContext.tsx](src/renderer/contexts/TabContext.tsx).
- Route permissions live in [src/renderer/router/permissions.ts](src/renderer/router/permissions.ts). Adding a new route means adding it to the right permissions list there.
- For UI gating use `hasPermission('PERMISSION_CODE')` from `useAuth()`. Don't read user permissions any other way.

### G7. Reusable building blocks — prefer over rebuilding
- Tables: `DataTable` + `Column<T>` from [src/renderer/components/common](src/renderer/components/common). It already does loading skeletons, pagination, sort, row-click. Don't roll your own table.
- Search inputs that hit the DB: pair `useDebouncedValue(value, 500)` with a paginated IPC call. Reset to `page=1` when the debounced filter changes.
- Modals: `useDisclosure()` for opened/close state.
- Form pattern: `useForm({ initialValues, validate })` then `<form onSubmit={form.onSubmit(handleSubmit)}>`. Bind inputs with `{...form.getInputProps('field')}`.
- Currency: `<NumberFormatter value={x} prefix="$" thousandSeparator decimalScale={2} />`.

### G8. Naming & file layout
- Components: `PascalCase.tsx` under [src/renderer/components/<domain>/](src/renderer/components/). Pages: `PascalCasePage.tsx` under [src/renderer/pages/<domain>/](src/renderer/pages/).
- Hooks: `useThing.ts` under [src/renderer/hooks/](src/renderer/hooks/).
- Stores (if introducing one): match whatever the plan section specifies (Zustand or Context). Don't introduce a third state lib.
- No path aliases — relative imports only. `tsconfig.json` does not define `paths`, so `@/foo` will fail.

### G9. Things you must not touch unless the plan explicitly says so
- `package.json` dependencies and scripts.
- `package-lock.json`.
- Anything under `out/`, `dist/`, `node_modules/`, `.vite/`.
- Migration files under [src/main/database/migrations/](src/main/database/migrations/).
- `tsconfig.json`, `forge.config.*`, `electron.vite.config.*`, ESLint/Drizzle config files.
- IPC channel names, controller method names, and DB column names — these are part of the data contract. The master plan calls out cosmetic/UI renames; those do **not** propagate to identifiers, types, schema, or channels unless the plan section says so.

### G10. Anti-hallucination protocol
Before you write a line of code that depends on an external symbol:

1. **Read the file you're about to import from.** Don't import `from 'foo'` from memory — open it and confirm the export.
2. **Grep for the symbol** if you're not 100% sure of its shape (`Grep` tool, content mode, output the surrounding lines).
3. **If a function signature is ambiguous, read the implementation, not the call site.** Call sites can be wrong.
4. **Don't fabricate prop names, hook return shapes, or context values.** If the plan implies a hook (`useTabContext`, `useAuth`), open its file and confirm what it actually exposes.
5. **When the master plan and the code disagree, the code wins.** Flag the discrepancy to the user; don't silently follow whichever feels right.
6. **Don't stub.** If you can't implement something, say so and stop — don't leave a `// TODO` placeholder that compiles but doesn't work.

### G11. Reporting
At the end, post a concise summary:
- What you changed (file:line markdown links).
- What you ran (`npm run lint`, manual checks) and the outcome.
- Any plan items you deliberately deferred and why.
- Any open questions from §6 / §7 of the plan that the implementation surfaced.

Keep the summary short. The user can read the diff.

---

## Now begin

1. Open [.plans/master-plan.md](.plans/master-plan.md), find the section matching `$ARGUMENTS`, and quote its scope back to the user in 2-3 sentences so they can confirm you've targeted the right thing.
2. If the section has unresolved open questions blocking implementation, list them and stop.
3. Otherwise, build the TodoWrite plan and execute it under the rules above.
