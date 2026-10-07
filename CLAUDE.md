# SHRI HEALTH (laboratory information system)

Two apps:

- `client/`: React frontend. A complete, frontend-only laboratory information system (no login, no backend). "Acting as" is a role switcher, not authentication; never describe the client-side permission checks as security.
- `server/`: Node.js backend (paused, empty). The client dev server proxies `/api` to `http://localhost:4000`.

## Client stack

React 19, TypeScript 6 (strict), Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first), React Router 7, TanStack Query 5, react-hook-form + zod 4, Radix UI (`radix-ui`), cmdk, sonner, lucide icons (`lucide-react`), Recharts, jsbarcode. Use npm.

**Checks:** run in `client/` before finishing: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`.

**Version pins:**

- TypeScript is `~6.0.x` because `typescript-eslint` doesn't support TypeScript 7.
- The machine runs Node 20, so react-router 8 and vitest 5 (which need Node 22+) aren't installed.

## Architecture (client/src)

- `domain/`: types (`as const` unions, no TS enums) and pure rules: flags, reference intervals, workflow status derivation, TAT, critical-value state, IDs, sample grouping, QC Westgard, stock. Unit tested in `domain/domain.test.ts`.
  - `permissions.ts`: the role permission matrix (`PERMISSIONS`, `ROLE_PERMISSIONS`, `hasPermission`, `rolesWith`; microbiologists authorise microbiology only).
  - `glossary.ts`: the controlled UI vocabulary (Specimen, Accession No., Verify, Authorise, Reference interval, UHID, "Awaiting <stage>"). `i18n/terminology.test.ts` fails on the old terms.
  - Statuses: orders add `awaiting-release` and `partially-reported`; `completed` needs every live test on a released report. Report versions are `preliminary`, `final` or `amended`; a report can be `withdrawn`.
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
      - Every mutation calls `requirePermission(db, ctx, perm)`; a refusal (`not-permitted`) names the person, their role and who may do it. The acting user is always the performer and signer: no API takes a caller-chosen `by`.
      - Collection and receipt times stay in order (no future times; backdating needs a reason); numeric results have plausibility limits; changing a submitted value needs a reason; reruns keep both values (with dilution); authorisation waits while QC has failed on the analyzer; release waits for criticals to be communicated (`settings.holdReleaseForCriticals`); an order cannot be cancelled once a specimen is in the lab.
      - Clinical safety (research pack Wave 1): collection needs `identity` (two identifiers), `fasting` for fasting tests and recorded consent for `consentRequired` tests (`engine/consent.ts`); a deferred collection (`scheduleCollection`) taken early needs a reason; receipt records `temperature` and flags a deviation; `splitSample` makes aliquots (`ACC-01`), `sendOutSample`/`updateSendOut` refer to active referral labs (`db.referralLabs`) and set `item.performedBy`; an add-on past `stabilityHours` gets a new specimen; calculated analytes (`domain/calculated.ts`) are computed at save, never typed; only `isRegisteredSignatory` people authorise (`Staff.signatory`, `admin.updateSignatory`); patients: Indian mobile, optional PIN/ABHA, no Aadhaar, audited `mergePatients`.
      - Share links (`engine/share.ts`): random 128-bit tokens stored as SHA-256, expiry, revoke, date-of-birth check with a lock after five failures (`attemptShareLink` returns refusals so the attempt is saved), access log, revoked on amendment/withdrawal. Each issued version is sealed (`digest`, `verifyToken`, `db.verifications`). `domain/sha256.ts` is the synchronous hash.
    - Every clinically or financially significant change writes `audit(db, ctx, entity, id, action, { reason, from, to, detail })` to `db.audit` (append-only, capped at `MAX_AUDIT_ENTRIES`). The activity feed is separate.
  - `api/`: async endpoints with latency that return DTOs (`api/types.ts`). `runtime.ts` applies the lab's TAT threshold (`setTatWarnRatio`) before every read and write.
- `services/lab-api.ts`: the single seam. It exports `labApi` and `demo` from `@/services/source`, the mock by default (`services/source/mock.ts`). `VITE_DATA_SOURCE=http` makes Vite alias it to `services/source/http.ts`, the HTTP adapter, and the mock is not bundled. Screens import only from the seam (and `services/queries.ts`), never from `@/mock`.
  - `services/contract.ts`: `LabApi` (the mock's shape minus demo-only `system.reset/stats`) and `DemoControls` (acting-as, demo latency/failures, storage, reset; `demo.enabled` is false with a backend and the screens hide those controls).
  - `services/http/`: `client.ts` (fetch with cookie credentials, `X-Request-Id`, `Idempotency-Key` on writes, AbortSignal and timeout, errors as `ApiError`), `endpoints.ts` (the REST table, typed against `LabApi`: a new API method fails typecheck until it has an endpoint), `lab-api.http.ts`, `contract.test.ts`. `npm run contract` writes `docs/api-contract.md`. Add an endpoint whenever you add an API method.
  - `domain/errors.ts`: `ERROR_CODES` (rules plus transport codes `network`, `timeout`, `unauthenticated`, `conflict`, `rate-limited`, `server-error`), `ApiError`, `FINAL_CODES` (not retried). Every code needs an `errors.<code>` message in all five languages.
  - Session: `labApi.session.get()`; `app/session-gate.tsx` shows "session ended" on 401 in http mode; the preferences' `actorId` is the session user there.
  - Long lists (orders, patients, reports, audit, work queue) page on the server: filters extend `PageQuery` (`page`, `pageSize`, `sort` = column id or `-id`), results carry `page: PageInfo` (`mock/api/paging.ts`, `paginate` with per-list sorters keyed by the table's column ids). Pages use `useTablePaging(pageSize, sortKeys)` (`hooks/use-table-paging.ts`, page and sort in the URL) and `DataTable server={paging.table(data?.page)}` with `sortable: true` columns. A filter change (`useUrlFilters.set`) returns to page 1. Exports fetch every matching row.
  - Sign-off screens (result entry, verification, report, critical results) use the `fresh` query options: refetch on mount and focus, never act on a cached copy.
  - `admin.recordAccess` audits PHI access: `useRecordView(entity, id)` on patient, report and imaging report pages (once per person per record per 30 min), `reports.recordPrint` audits prints, `ExportButton` (needs `entity`) audits exports before downloading.
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
  - Status badges (order/sample/result/report/critical/stock/equipment/QC/priority), ResultFlag, RangeText, ContainerChip/TubeDot, SamplePipeline, PatientCell/AgeSex, TatIndicator/Waiting, KpiCard (Dashboard).
  - TestChips, ReasonDialog, HistoryTimeline, TestPicker, LabelPrintDialog, CriticalStateBadge, ConnectionBadge.
  - `RecordLink kind=patient|order|specimen|report`: every displayed UHID, order number, accession and report number links to its record. `PatientBanner`: the patient identity banner on every patient-scoped screen.
  - `GuardedButton permission=...` (disabled with the reason when the acting user may not), `SigningAs` (who signs; offers to switch "acting as"), `RerunDialog`, `ExportButton` (CSV, `data.export` only; `lib/csv.ts` guards against formula injection).
  - `FilterBar`: primary filters inline, secondary ones in `more` (a "More filters" popover with `moreCount`), "Clear all" (`onClear` / `canClear`), and `chips` so filters hidden in "More" show as removable chips.
- **URL state:** filters, tabs and sections live in the URL so views can be linked and survive reloads.
  - `hooks/use-search-param.ts` provides `useUrlFilters(defaults, allowed)` (`values`, `set`, `clear`, `activeCount`) and `useSearchParam(key, fallback, allowed)`. Both validate values against the allowed list.
  - `?new=1` opens the create dialog on the patients, QC and reagents pages; the command palette uses it.
- **Persistence:** `usePersistentState(key, initial, isValid)` and `readStored` validate what they read (`oneOf`, `sameShape`) and sync across tabs.
- **Forms:** show `FormErrorSummary` (`components/ui/form-errors.tsx`, with `countFieldErrors` from `lib/form-errors.ts`) above long forms, and pass `focusInvalid` as `handleSubmit`'s second argument.
  - Import zod from `@/features/shared/zod` (it turns off zod's `new Function` probe, which the CSP forbids), never from `'zod'` directly.
  - Pages with unsaved work use `useUnsavedChanges(dirty, skip?)` (`hooks/use-unsaved-changes.ts`: in-app navigation and tab close) with `UnsavedChangesDialog`.
- **Focus:** `Dialog`, `Drawer`, the command palette and the mobile nav use `useReturnFocus(open)` (`components/ui/return-focus.ts`). Radix only returns focus to a `Dialog.Trigger`, and these open from state; the hook returns focus to what had it before, even when the dialog unmounts.
- **Errors:** `ErrorBoundary` (`components/ui/error-boundary.tsx`) wraps the drawer host and the notification panel; the routes have `errorElement`s. `app/global-errors.tsx` toasts any unhandled error or rejection (throttled) and announces a returning connection; the header shows an offline notice (`hooks/use-online.ts`).
- `app/`:
  - Shell: sidebar, header, command palette, notifications, and drawer host (`?order=` / `?sample=` open drawers anywhere).
  - Providers for theme, i18n and preferences (working department, acting-as staff, density, reduced motion, higher contrast; the last three set `data-density`, `data-reduce-motion` and `data-high-contrast`).
  - `FirstRunDefaults` applies the lab's default language and department on a browser's first visit.
  - `routes.tsx`: lazy page modules that export `Component`. Paths sit directly under the base: `/dashboard` (where `/` goes), `/work-queue`, `/patients/:id`, `/orders`, `/collection`, `/reception`, `/specimens/:id`, `/worklists`, `/results/:sampleId`, `/verification`, `/reports/:id`, `/critical-results`, `/tat`, `/analytics`, Diagnostic Imaging (`/imaging` dashboard, `/imaging/ct`, `/imaging/mri`, `/imaging/x-ray`, `/imaging/reports/:studyId`), the Administration group (`/test-catalog`, `/users`, `/audit-log`, `/settings`), and the inventory and operations screens. Old `/laboratory/...` links redirect (`app/legacy-paths.ts`).
  - Public pages sit outside the shell and its `SessionGate` (`features/portal/`): `/r/:token` (a shared report after the patient's date of birth, `labApi.portal.open`), `/v/:token` (the QR verification page, `labApi.portal.verify`, no patient data) and `/report/:reportNo` (old links: "no longer valid"). They receive the lab identity with the report (`PublicLab`), never staff settings. Demo: links work in the browser that made them.
- **Lab Assistant** (`app/layout/assistant/lab-assistant.tsx`, design system 13): the "AI" launcher, a panel docked beside the page from 1280px (`data-chat-docked` on `<html>` pads `#main`) or a sheet below. The launcher is 48px in the bottom-right corner; `#main` keeps bottom padding for it (`styles/base.css`) so the last row of every page scrolls clear, and nothing else floats over the page: the day's tip waits as a dot on the launcher and shows as the panel's first card, once per session. It is rule-based, not AI: the panel talks only to `services/assistant.ts` (`AssistantService`), today backed by `mock/api/assistant.ts`, which reads the same `today` read model as the dashboard. Replies are message keys plus values (`assistant` namespace) or plain data text. Pages with a sticky bottom bar call `useAssistantClearance(px)`.
- **Today's work read model** `labApi.today.get()` (`mock/api/today.ts`): priorities, to-do, agenda (real deadlines plus `domain/lab-day.ts` routine slots) and the day's summary. The Dashboard and the assistant both read it. `labApi.today.calendar({ from, to })` gives the dashboard calendar day-by-day figures (recorded `dailyStats`, today live via `todayStat`, scheduled imaging; at most 62 days), with `busyLevel` (`domain/lab-day.ts`) graded in the API.
- **Report documents** (`components/lab/documents/`): `LabDocument` (responsive, the portal) and `ImagingDocument` (screen, print and PDF). Print and Download PDF use `usePrint`; Download asks `services/report-files.ts` for a server PDF first (none yet). `reports.get(id, { version })` and `imaging.report(id, { version })` rebuild earlier versions from their stored versions; never overwrite one.
- **Imaging** (`domain/imaging.ts`, `mock/db/seed/imaging.ts`, `mock/api/imaging.ts`): studies with versioned reports on existing demo patients; read-only apart from share links. The patient page's Reports tab lists `reportHistory` (laboratory and imaging together).
- **Business (Wave 2):** billing (`domain/billing.ts`, `engine/billing.ts`, `/billing`, `/billing/:invoiceId`, `/billing/day-book`, `/billing/masters`; payments are recorded, never processed), the network (`engine/network.ts`: doctors and collection centres on `/referrers`, home visits on `/home-collection`), messaging (`engine/messaging.ts`, `/messages`: templates and an outbox where every message is `not-sent` with its reason; per-patient opt-outs on the patient's Consents tab) and the referring doctor portal (`mock/api/doctor.ts`, `/my-patients`). Roles `owner` (business, no bench work) and `doctor` (`Staff.doctorId`; sees only the "My practice" nav and their own patients' released reports; `/` sends them to `/my-patients`; `app/layout/use-role-home.ts` moves between homes when "acting as" changes).
- **Quality and compliance (Wave 3):** `domain/quality.ts` (EQA z-score, risk score, CAPA steps, document review, deadlines, renewal window, measurement uncertainty, UCUM), `domain/modules.ts` (module presets by size), engines `quality.ts`, `privacy.ts`, `interfaces.ts`, `autoverify.ts`, APIs `mock/api/quality.ts`, `registers.ts`, `compliance.ts` (privacy, interfaces, sites, auto-verification, insights). Screens: `/quality` (tabs: overview, eqa, capa, documents, audits, risks, lis, uncertainty, autoverify), `/cold-storage`, `/registers` (Tamil Nadu Form III, daily results, IQC, collection), `/privacy` (DPDP requests, incidents with CERT-In 6 h and Board 72 h deadlines, legal holds, retention), `/interfaces` (simulated analyser traffic, versioned code maps, LOINC/UCUM coverage), Settings sections for the lab profile, modules and size tier, sites, and the assistant and auto-verification switches.
  - Auto-verification is off by default (`settings.autoVerifyEnabled`); approved rules only mark results (`Result.autoCheck`), a person still authorises. Insights (`labApi.insights`, `components/lab/insight-card.tsx`) are rule-based with their evidence and audited feedback; nothing is AI.
  - Modules: `settings.modules` hides nav items (`NavItem.module`, `app/layout/use-visible-nav.ts`) and `ModuleGate` (`app/layout/module-gate.tsx`, `modules.ts` maps route prefixes) shows a notice on a switched-off module's routes. `NavItem.anyOf` hides items from roles without any of those permissions.
  - Orders carry `siteId` (missing means the main lab); the orders list filters by site.
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
- **Brand:**
  - The product is named "SHRI HEALTH" (`common.appName` / `appTitle`).
  - The ribbon mark is `client/public/favicon-192.png`, drawn by `Logo` (`components/ui/logo.tsx`) in the sidebar and on the printed report. `favicon-32.png` and `apple-touch-icon.png` are cropped copies of it; regenerate them if the mark changes.
  - The ribbon opens https://shri-ai.org/dev/ and the Indo States Health wordmark (`IndostatesLogo`) opens indostates.com, both in a new tab. URLs and names live in `lib/brand.ts`.
  - The wordmark sits in the header's top-right corner from 768px (phones keep it in the menu drawer's `CoBrandRow`) and is printed at the top right of every report.
  - `indostates-logo.webp` is a cropped copy of `public/logo-indostates.png` with its own white backing for dark mode; regenerate it if the logo changes.
- **`PageHeader`** (`app/layout/page-header.tsx`) is the only page header: `title`, `meta`, `actions`, `back`, `titleExtra`. It sets `document.title` via `useDocumentTitle`.
- **KPIs:** `MetricStrip` / `Change` on working screens. The Dashboard (`/dashboard`; its nav key is still `overview`) follows the clinician-portal layout the product owner chose, in `features/dashboard/home.tsx`, with the design system's tokens:
  - Header: a greeting with the acting user's name, then the date, shift, department and lab.
  - In order: the KPI row (4 `KpiCard`s with 14-day trends), 5 pastel stat tiles (`stat-*` tokens; the solid icon square is deliberate here), then Today (hourly strip and agenda timeline) | Specimens today (In lab / To collect) | the calendar (`calendar-card.tsx`: week or month, previous/next/Today, arrow keys, `?cal=` and `?day=` in the URL, the chosen day's figures with an Analytics link, the routine and scheduled imaging ahead), then Needs action (Attention by severity and Tasks: the work-queue counts) full width, then "Laboratory performance" (pipeline, TAT, workload, analyzers, stock).
  - Each fact appears once. Every row links to the filtered screen, and the counts come from `labApi.today` (`today.test.ts` checks them against the queues). Layout uses container queries, so it fits beside the docked assistant.
  - Sizing is compact to match the doctor portal: cards `p-3.5 sm:p-4`, gaps `gap-4` (tiles and KPIs `gap-3`), rows about 46px, stat tiles about 75px and KPI cards about 85px at 2048px. Text sizes are unchanged; secondary lines use `text-2xs`.
  - The routine jumps live in a "Quick actions" menu in the page header.
- **Motion:** only from the design system's catalogue (150–250ms, `--ease-premium`); card hover lifts 2px (`card-hover`); rings draw in once. Nothing loops except skeletons; reduced motion clamps everything.
- **Tables:** at most 2 badges per row; `PriorityMark` for priority. Columns size to their content (base rules restore intrinsic widths inside `td`); a column with id `actions` stays pinned to the right edge and the first column to the left (opt out with `sticky: false`); both show an edge shadow while the table is scrolled.
  - `Column.tabletHidden` drops secondary columns below 1536px, and `minWidth` applies only from 1536px. Every table fits without scrolling from 1280px up; check with a measurement script after adding columns.
  - Clickable rows get a visually hidden open button in the first cell, named by `rowLabel`, instead of a focusable `<tr>`.
  - Tint a row that needs attention with the `row-alert` class. It also tints the pinned cells; a `bg-*` class on the row does not.
  - Below `md`, `DataTable` renders stacked records; tune with `mobile={{ primary, fields, actions }}` and `Column.mobileHidden`.
- **Layout:** a base rule gives `.grid` a `minmax(0,1fr)` track, so plain grids never overflow. Anything `whitespace-nowrap` inside flex must be able to wrap or scroll. Verify at 320px.
- **Mobile:** below 768px a bottom navigation bar (`app/layout/bottom-nav.tsx`: Home, Queue, Scan, Patients, More) sits above the content; `--bottom-nav-h` keeps `#main`, the AI launcher, sticky action bars (`bottom-[calc(1rem+var(--bottom-nav-h,0px))]`) and toasts above it. `public/manifest.webmanifest` makes the app installable (no service worker).
- **Shell:** header 64px (`bg-surface/95` + blur, sun/moon switch; breadcrumbs, a compact search, the controls and the partner mark; no critical pill, criticals live on the Dashboard and the nav count); the sidebar is 256px expanded / 72px rail, persisted, toggled with `[` on desktop. 768–1023px is always the rail; below 768px it becomes the design system's drawer. Route changes focus `main` and announce the title.
- **Build and deploy:**
  - `base` comes from `BASE_PATH` (default `/dev/laboratory/`); the router's `basename` derives from it (`app/router.ts`), so never hard-code either.
  - `npm run package` builds and writes `dev-laboratory/` and `dev-laboratory.tar.gz` (`scripts/package.mjs`).
  - No source maps unless `SOURCEMAP=true`.
  - `vite.config.ts` groups chunks: vendors (react, router, query, radix, forms, icons), `mock`, and `core` (components/ui, hooks, lib, services, domain). Measured on a throttled phone, this cut a warm reload from 3.0 to 1.2 s. jsbarcode loads on first use.
  - Only the script subsets of the Noto fonts are bundled (`styles/fonts.css`).
  - Production builds have no simulated API latency, and an untouched demo seed is saved and reused within the IST day.
  - A `vite:preloadError` after a release reloads the tab, at most once a minute (`main.tsx`).
  - Builds are deterministic (byte-identical). `deploy/nginx.conf.example` and `deploy/security-headers.conf` document the server setup (SPA fallback, cache rules, CSP); `npm run package` writes `deploy/security-headers.generated.conf` with the inline script's CSP hash. They are documentation, not applied to any server. Keep the CSP clean: no eval, no new inline scripts.
- **Tests:**
  - `domain/domain.test.ts` (pure rules), `mock/db/store.test.ts` (corrupt, old and time-shifted saved data) and `mock/db/seed/integrity.test.ts` (data rules D1 to D14 on the fresh and shifted seed).
  - `mock/api/*.test.ts`: `workflow`, `controls` and `guards` (rule and permission refusals), `operations`, `scenarios` (cross-screen consistency, dashboard tile counts) and `journeys` (the audit's journeys B to E).
  - `mock/api/billing.test.ts`, `network.test.ts` (doctor scoping, revenue gating, home visits, outbox) and `compliance.test.ts` (Wave 3 rules and refusals).
  - `mock/api/today.test.ts`: Today's Work counts match the queues, assistant answers follow state, share links (tokens, date of birth, lock, expiry, revoke) and verification, version reads, imaging, the patient report history and the dashboard calendar.
  - `mock/api/clinical-safety.test.ts`: the Wave 1 rules and their refusals; `mock/api/paging.test.ts`: server paging and access audit; `services/http/contract.test.ts`: the endpoint table and the HTTP client.
  - `mock/api/performance.test.ts` runs only with `npm run test:perf` (10x the demo data; reads must stay under 400 ms).
  - `app/routes.test.tsx` renders every route; `i18n/terminology.test.ts` enforces the glossary; `lib/csv.test.ts`.
  - API tests act as a role: `actingAs(STAFF.pathologist).reports.release(id)` (`mock/api/testing.ts`).
- **Translations:** every namespace is translated in hi/kn/ta/ml. `i18n/locales.test.ts` enforces key and placeholder parity, so every new key needs all five languages (reuse each locale's established terms: read its existing files first).

## UI and design work

Taste skills are installed in `.claude/skills/`. `design-taste-frontend` applies to marketing surfaces; this app follows the product-UI conventions above.
