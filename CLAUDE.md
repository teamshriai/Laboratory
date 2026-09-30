# SHRI HEALTH (laboratory information system)

Two apps:

- `client/`: React frontend. A complete, frontend-only laboratory information system (no login, no backend).
- `server/`: Node.js backend (paused, empty). The client dev server proxies `/api` to `http://localhost:4000`.

## Client stack

React 19, TypeScript 6 (strict), Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first), React Router 7, TanStack Query 5, react-hook-form + zod 4, Radix UI (`radix-ui`), cmdk, sonner, lucide icons (`lucide-react`), Recharts, jsbarcode. Use npm.

**Checks:** run in `client/` before finishing: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`.

**Version pins:**
- TypeScript is `~6.0.x` because `typescript-eslint` doesn't support TypeScript 7.
- The machine runs Node 20, so react-router 8 and vitest 5 (which need Node 22+) aren't installed.

## Architecture (client/src)

- `domain/`: types (`as const` unions, no TS enums) and pure rules: flags, reference ranges, workflow status derivation, TAT, critical-value state, IDs, sample grouping, QC Westgard, stock. Unit tested in `domain/domain.test.ts`.
- `mock/`: the "backend in the browser". **The engine is the only place with rules**; screens never re-check them.
  - `db/`: schema, store (localStorage, schema-versioned) and a deterministic seed that replays every order through the engine.
    - Bump `SCHEMA_VERSION` when the shape changes. Older or unreadable saved data is reseeded, old keys are removed, and the user sees a one-time notice (`wasDataRefreshed`).
  - `engine/`: mutations `(db, input, ctx)` that enforce the workflow.
    - Results go entered → reviewed (technical review: technician, lab manager, pathologist or microbiologist) → validated (authorisation: pathologist or microbiologist). A validator may do both in one action, and it is recorded as two steps. `settings.requireIndependentReview` blocks self-review.
    - Other rules the engine enforces:
      - Read-back is required to acknowledge a critical value; every notification attempt is kept.
      - Corrections wait in `pendingAmendment` until a pathologist authorises them.
      - Offline, broken or QC-held analyzers refuse new work.
      - Lot operations check the lot's state.
    - Every clinically or financially significant change writes `audit(db, ctx, entity, id, action, { reason, detail })` to `db.audit`. The activity feed is separate.
  - `api/`: async endpoints with latency that return DTOs (`api/types.ts`). `runtime.ts` applies the lab's TAT threshold (`setTatWarnRatio`) before every read and write.
- `services/lab-api.ts`: the single seam re-exporting the mock. Swap this file for `apiClient` calls when the Node backend exists.
  - `services/queries.ts`: every TanStack Query hook.
  - `services/mutations.ts`: `useLabMutation(fn, { success, onSuccess })` invalidates `['lab']` and shows toasts, including translated errors.
- `i18n/`: typed translations.
  - `useT('ns')` returns `t(key, params)`. `useEnum()` returns `e(group, value)`. `useFormat()` gives Intl date/number/INR formatting in IST.
  - English lives in `locales/en/<ns>.ts`; `hi/kn/ta/ml` mirror it and fall back to English.
  - **Never hard-code UI copy.** Test and analyte names, codes, units and person names stay as recorded data.
- `components/ui/`: design-system primitives.
  - Button, IconButton (tooltip required), Badge/Count, Card/CardHeader/CardBody/Detail, Input/Textarea/SearchInput, Field (label, hint, error; errors can be `forms.xxx` keys), Select, Combobox, Checkbox, Switch, ChoiceCards, Segmented, FilterTabs, Tabs/TabsList.
  - Menu, Popover, Dialog, Drawer, ConfirmDialog, Skeleton set, EmptyState, ErrorState, DataTable, Avatar, Timeline, Stepper, Meter, Barcode, print (`usePrint`), Tooltip.
  - IconTile (`soft` default / `solid`), SoftIconTile, IconGlyph; MetricStrip/Change.
- `components/charts/`: `chart-kit` (legend, tooltip, table twin) and `micro` (Ring gauge, Donut, CountdownRing, TrendLine).
- `components/lab/`: domain widgets.
  - Status badges (order/sample/result/report/critical/stock/equipment/QC/priority), ResultFlag, RangeText, ContainerChip/TubeDot, SamplePipeline, PatientCell/AgeSex, TatIndicator/Waiting, SnapshotTile/KpiCard (Overview).
  - TestChips, ReasonDialog, HistoryTimeline, TestPicker, LabelPrintDialog, CriticalStateBadge, ConnectionBadge.
  - `FilterBar`: primary filters inline, secondary ones in `more` (a "More filters" popover with `moreCount`), plus "Clear all" (`onClear` / `canClear`).
- **URL state:** filters, tabs and sections live in the URL so views can be linked and survive reloads.
  - `hooks/use-search-param.ts` provides `useUrlFilters(defaults, allowed)` (`values`, `set`, `clear`, `activeCount`) and `useSearchParam(key, fallback, allowed)`. Both validate values against the allowed list.
  - `?new=1` opens the create dialog on the patients, QC and reagents pages; the command palette uses it.
- **Persistence:** `usePersistentState(key, initial, isValid)` and `readStored` validate what they read (`oneOf`, `sameShape`) and sync across tabs.
- **Forms:** show `FormErrorSummary` (`components/ui/form-errors.tsx`) above long forms, and `focusFirstInvalid` (`lib/focus.ts`) on a failed submit.
- **Focus:** `Dialog`, `Drawer`, the command palette and the mobile nav use `useReturnFocus(open)` (`components/ui/return-focus.ts`). Radix only returns focus to a `Dialog.Trigger`, and these open from state; the hook returns focus to what had it before, even when the dialog unmounts.
- **Errors:** `ErrorBoundary` (`components/ui/error-boundary.tsx`) wraps the drawer host and the notification panel; the routes have `errorElement`s.
- `app/`:
  - Shell: sidebar, header, command palette, notifications, and drawer host (`?order=` / `?sample=` open drawers anywhere).
  - Providers for theme, i18n and preferences (working department, acting-as staff, density, reduced motion, higher contrast; the last three set `data-density`, `data-reduce-motion` and `data-high-contrast`).
  - `FirstRunDefaults` applies the lab's default language and department on a browser's first visit.
  - `routes.tsx`: lazy page modules that export `Component`.
- `features/<area>/`: one folder per screen area. `features/orders/orders-page.tsx` and `order-drawer.tsx` are the reference patterns.

## Conventions (the React Compiler lint rules are errors)

- **No `Date.now()` / `new Date()` in render.** Use `useNow()` (a shared 30 s clock).
- **No `setState` synchronously inside `useEffect`.**
- **No in-place sorts:** use `toSorted` / `toReversed`.
- **react-hook-form:** use `useWatch`, not `watch`. Type forms as `useForm<z.input<S>, unknown, z.output<S>>`. Wrap `handleSubmit` like `onClick={() => void handleSubmit(fn)()}`.
- **Page modules export only `function Component()`.** Hooks and helpers used in several places live in `.ts` files.
- **Colours come only from theme tokens.** The default Tailwind palette is disabled (only `white` exists, for text on solid tiles). Use `bg-surface`, `bg-surface-2`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-line` (dividers) / `border-border` (card edges), `bg-accent`/`text-on-accent`, `bg-accent-soft`/`text-accent-text`, `primary-50..900`, and the same `-soft`/`-text` pattern for `success`, `warning`, `danger` and `info`. Charts use `chart-1`..`chart-6`; tubes use `tube-*`; solid tiles use `tile-*`.
- **Status is never colour-only:** always an icon and/or text. No em dashes in UI copy (use a hyphen in ranges: `13.0 - 17.0`).
- **Every list and detail view has loading (skeleton), empty and error states.** Icon-only buttons use `IconButton` with a label.
- **Charts follow the dataviz rules:**
  - Categorical order is blue, orange (the design system's pair), teal, violet, amber (`chart-1`..`chart-5`, validated for both themes); `chart-6` is the neutral comparison. Two-series charts use `chart-1` and `chart-2`.
  - A legend whenever there are two or more series, hover tooltips, one y-axis, thin marks, 4px rounded data ends, recessive grid.

## Design system rules

**`/DESIGN_SYSTEM.md` (the SHRI HEALTH portal design system) is the source of truth for look, feel and behaviour.** Read it before UI work. How this app maps onto it:

- **Tokens** (`styles/theme.css`) hold the design system's values under the app's older names: `canvas` = `bg`, `surface` = `surface-1`, `line` = `border-soft`, `line-strong` = `border-strong`, `fg*` = `ink*`, `accent*` = `primary-600/700/50`, `danger-soft/-text` = `critical-bg/-fg`. Solid `danger` is reserved for critical lab values, the lab's emergency. The design system's own names (`primary-*`, `border`, `tile-*`, `pastel-*`, `ai`, `focus`, `scrim`) exist too.
- **Type:** Plus Jakarta Sans; the design system's scale (`2xs` 12px, `xs`/`meta` 13px, `sm` 14px is the reading floor). Page titles `text-xl sm:text-2xl` via `PageHeader`; KPI values `text-2xl font-semibold leading-none tracking-tight tabular-nums`.
- **Radius:** `sm` 4px, `md` 8px (small badges), `lg` 12px (buttons, inputs, nav and menu items, toasts), `xl` 16px (cards, tiles, menus, dialogs), `2xl` 20px, `full` for avatars, pills and switches. Icon tiles use their squircle radii (`IconTile` sizes).
- **Form controls:** inputs, selects and comboboxes (`controlClass`) have a `line-strong` edge at rest (3:1, WCAG 1.4.11), and invalid fields a full `danger-text` edge. This deliberately departs from the design system's lighter `border`.
- **Targets and density:** every control is at least 44px.
  - `Button` sm/md are `min-h-11`; `xs` (36px) is only for dense table rows.
  - Compact controls (`xs` buttons, small `Select` and `Segmented`) grow to 44px under `pointer-coarse:`.
  - Small icon buttons and standalone small links use `.tap-reach`.
  - Inline data links need at least 24px (`py-0.5`). The shell sets `data-density="compact"`, so `.clinical-row` rows are 32px.
- **Icons (user preference, overrides the design system's tiles):** lucide only, drawn as **transparent duotone glyphs with no container**: no tile, chip, well or ring behind a decorative icon. `IconTile` / `SoftIconTile` / `IconGlyph` all render the `.duo-icon` style: the stroke is the destination hue softened toward ink, and closed shapes get a faint fill of the same hue (`.duo-on-fill` for white glyphs on solid tiles). Colours stay soft, never harsh. Destination hues come from `NAV_TONES` / `DEPARTMENT_TONES` (`lib/icon-tones.ts`, the design system's `TONE_HEX`), so each screen and department keeps its own colour; avoid grey `slate` for decorative icons. Use CSS `size-*` classes; `LucideProvider` sets defaults (16px in the shell).
- **Brand:** the product is named "SHRI HEALTH" (`common.appName` / `appTitle`). The mark is `client/public/favicon-192.png`, drawn by `components/ui/logo.tsx` in the sidebar and on the printed report. `favicon-32.png` and `apple-touch-icon.png` are cropped copies of it; regenerate them if the mark changes.
- **`PageHeader`** (`app/layout/page-header.tsx`) is the only page header: `title`, `meta`, `actions`, `back`, `titleExtra`. It sets `document.title` via `useDocumentTitle`.
- **KPIs:** `MetricStrip` / `Change` on working screens. The Overview is the dashboard (design system section 9): a bento grid (`features/dashboard/dashboard-page.tsx`, auto-placement only, the skeleton rendered from the same `CELLS`) with gradient `SnapshotTile`s (a faint watermark glyph, white text), hue-tinted `KpiCard`s with 14-day trends, the pipeline flow, a TAT gauge, a donut, a solid activity timeline and "Go to" tiles.
- **Motion:** only from the design system's catalogue (150–250ms, `--ease-premium`); card hover lifts 2px (`card-hover`); rings draw in once. Nothing loops except skeletons; reduced motion clamps everything.
- **Tables:** at most 2 badges per row; `PriorityMark` for priority. Columns size to their content (base rules restore intrinsic widths inside `td`); a column with id `actions` stays pinned to the right edge and the first column to the left (opt out with `sticky: false`); both show an edge shadow while the table is scrolled.
  - `Column.tabletHidden` drops secondary columns below 1536px, and `minWidth` applies only from 1536px. Every table fits without scrolling from 1280px up; check with a measurement script after adding columns.
  - Clickable rows get a visually hidden open button in the first cell, named by `rowLabel`, instead of a focusable `<tr>`.
  - Tint a row that needs attention with the `row-alert` class. It also tints the pinned cells; a `bg-*` class on the row does not.
  - Below `md`, `DataTable` renders stacked records; tune with `mobile={{ primary, fields, actions }}` and `Column.mobileHidden`.
- **Layout:** a base rule gives `.grid` a `minmax(0,1fr)` track, so plain grids never overflow. Anything `whitespace-nowrap` inside flex must be able to wrap or scroll. Verify at 320px.
- **Shell:** header 64px (`bg-surface/95` + blur, sun/moon switch); the sidebar is 256px expanded / 72px rail, persisted, toggled with `[` on desktop. 768–1023px is always the rail; below 768px it becomes the design system's drawer. Route changes focus `main` and announce the title.
- **Build:** `vite.config.ts` splits stable vendor chunks (react, router, query, radix, forms) and the mock backend (`mock`), and emits hidden source maps. jsbarcode loads on first use.
- **Tests:**
  - `domain/domain.test.ts` (pure rules) and `mock/db/store.test.ts` (corrupt and old saved data).
  - `mock/api/*.test.ts`: `workflow`, `controls` (rule refusals) and `operations`, plus `scenarios` (cross-screen consistency).
  - `app/routes.test.tsx` renders every route.
- **Translations:** `nav`, `header`, `common`, `enums`, `reports` and `dashboard` are translated in hi/kn/ta/ml. `i18n/locales.test.ts` enforces key and placeholder parity for any namespace a locale defines, so new keys in those namespaces need all five languages.

## UI and design work

Taste skills are installed in `.claude/skills/`. `design-taste-frontend` applies to marketing surfaces; this app follows the product-UI conventions above.
