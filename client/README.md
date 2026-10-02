# SHRI HEALTH client

Frontend for the SHRI HEALTH laboratory information system: orders, specimen collection and reception, worklists, technical verification and medical authorisation, critical results, reports, quality control, inventory, TAT and an audit log.

> **This build is a demonstration.** All data is generated, kept only in the browser (localStorage) and never sent anywhere. "Acting as" a staff member is a role switcher, not a login: the permission checks show how the workflow is meant to be controlled, but anyone with the browser can switch roles. Do not use it with real patient data. Real authentication, server-side authorisation and a shared, tamper-evident audit trail need the backend (see [Backend seam](#backend-seam)).

## Stack

- React 19 + TypeScript 6 (strict), built with Vite 8 (rolldown)
- Tailwind CSS v4 through `@tailwindcss/vite` (CSS-first config in `src/styles/`, no `tailwind.config.js`)
- React Router 7, TanStack Query 5, react-hook-form + zod 4, Radix UI, cmdk, sonner, lucide icons, Recharts
- ESLint (type-aware, React Compiler rules as errors) + Prettier (with Tailwind class sorting)
- Vitest + Testing Library + jsdom

## Getting started

Requires Node `^20.19.0 || >=22.12.0`.

```sh
npm install
cp .env.example .env.local   # optional, defaults work out of the box
npm run dev                  # http://localhost:5173/dev/laboratory/
```

## Scripts

| Script              | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Start the dev server with HMR                                    |
| `npm run build`     | Type-check, then build to `dist/`                                |
| `npm run package`   | Build, then pack it for the server (see [Deploying](#deploying)) |
| `npm run preview`   | Serve the production build locally                               |
| `npm run typecheck` | Run the TypeScript compiler (no emit)                            |
| `npm run lint`      | Lint with ESLint (`lint:fix` to auto-fix)                        |
| `npm run format`    | Format with Prettier (`format:check` for CI)                     |
| `npm test`          | Run Vitest in watch mode                                         |
| `npm run test:run`  | Run the test suite once                                          |
| `npm run test:perf` | Stress test at 10x the demo data (slow, about two minutes)       |
| `npm run coverage`  | Run tests with V8 coverage                                       |

Before finishing a change: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`.

## Environment

| Variable                | Default                 | Purpose                                                         |
| ----------------------- | ----------------------- | --------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | `/api`                  | Base URL the future backend client will call (`src/lib/env.ts`) |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | Where the dev server forwards `/api` requests                   |
| `BASE_PATH`             | `/dev/laboratory/`      | URL path the site is served under (build time)                  |
| `SOURCEMAP`             | `false`                 | `true` emits unlinked source maps for debugging                 |

No secrets belong in these variables: everything prefixed `VITE_` ends up in the public JavaScript.

## Architecture

`CLAUDE.md` in the repository root is the detailed guide. In short:

- `src/domain/`: types and pure rules (flags, reference intervals, workflow status derivation, TAT, permissions, glossary).
- `src/mock/`: the "backend in the browser". `engine/` holds every workflow rule (state transitions, role permissions, audit entries); `api/` exposes async endpoints returning DTOs; `db/` stores the data and replays a deterministic seed through the engine.
- `src/services/lab-api.ts`: the single seam the screens call. `queries.ts` and `mutations.ts` wrap it in TanStack Query.
- `src/features/<area>/`: one folder per screen area. `src/components/ui/` holds the design-system primitives and `src/components/lab/` the laboratory widgets.
- `src/i18n/`: typed translations (English, Hindi, Kannada, Tamil, Malayalam).

## Backend seam

`src/services/lab-api.ts` re-exports the in-browser mock. To connect the Node backend, replace it with an object of the same shape whose methods call the server (`fetch` against `env.apiBaseUrl`); the screens and their tests do not change. The server must then enforce, not the browser:

- **Who may do what.** The role permission matrix (`src/domain/permissions.ts`) and the signer rules: the authenticated user is always the performer and signatory; independent review; microbiologists authorise microbiology only.
- **Workflow transitions.** Everything in `src/mock/engine/` (collection and receipt chronology, plausibility limits, reasons for changes, reruns, QC holds, critical-value read-back before release, preliminary, final, amended and withdrawn reports, corrections authorised by a pathologist).
- **The audit trail.** Append-only, written in the same transaction as the change, with who, what, when, before and after, and the reason. It must not be editable by any user.
- **Identity and sessions.** Real login, session expiry and server-side checks on every request. None of this exists in the demo.

`src/mock/api/*.test.ts` describe the expected behaviour and can be reused as API contract tests.

### Where future endpoints connect

The screens call `labApi` (through `services/queries.ts` and `services/mutations.ts`). Each group maps onto a REST resource. These are suggested shapes, not an existing API:

| `labApi` call                                      | Future endpoint                                       |
| -------------------------------------------------- | ----------------------------------------------------- |
| `patients.get(id)` (with `reportHistory`)          | `GET /api/patients/:id`                               |
| `reports.get(id, { version })`                     | `GET /api/reports/:id?version=n`                      |
| `reports.release`, `withdraw`, corrections         | `POST /api/reports/:id/release` and so on             |
| `reports.shareLink(id)`                            | `POST /api/reports/:id/share`                         |
| `portal.report(reportNo, { version })`             | `GET /api/public/reports/:reportNo` (link-gated)      |
| `reportPdf(reportNo)` (`services/report-files.ts`) | `GET /api/reports/:id/pdf`                            |
| `imaging.overview / list / report`                 | `GET /api/imaging/studies`, `/studies/:id`            |
| `today.get()`                                      | `GET /api/worklists/today`                            |
| `assistant.ask` (`services/assistant.ts`)          | `POST /api/assistant/ask`                             |
| `samples.*`, `results.*`, `validation.*`           | `/api/specimens`, `/api/results`, `/api/verification` |

Two seams are deliberately narrower than `labApi`:

- `services/assistant.ts`: the Lab Assistant panel talks only to `AssistantService` (`suggestions`, `ask`). Replies are structured (message keys with values, or plain text), so a backend or AI service can answer in the same shape.
- `services/report-files.ts`: returns a server PDF when one exists; until then, Download PDF prints the report and the browser saves it as PDF.

### Prepared, not implemented

These have data shapes and UI places ready but no real implementation:

- Share links: the link is `.../report/<report number>` and works only in the browser that made it. Access control, expiry (`ReportLink.expiresAt` is reserved) and revocation need the backend.
- Patient and doctor portals: `PatientReportEntry` (laboratory and imaging reports per patient, newest first) is the list both portals will show.
- Imaging: studies and reports are demo data and read-only here. Scheduling, acquisition and reporting come from a RIS/PACS (DICOM, HL7) through the backend.
- Server-generated PDFs, SMS, email and WhatsApp delivery, analyzer interfaces (HL7/ASTM) and a real AI assistant.

## Deploying

```sh
npm run package
```

This produces, in `client/`:

- `dev-laboratory/`: the site, about 90 files and 2.9 MB.
- `dev-laboratory.tar.gz`: the same folder as one file of about 1.2 MB. Copying one archive is much faster than copying the folder. Unpack it on the server with `tar -xzf dev-laboratory.tar.gz`. The folder name follows `BASE_PATH`.
- `deploy/security-headers.generated.conf`: the security headers for nginx, with the Content-Security-Policy hash of this build's one inline script.

`deploy/nginx.conf.example` shows a matching nginx setup. It is documentation only and is not applied to any server by this repository:

- Every client-side route falls back to `index.html` (deep links and refreshes work, and old `/dev/laboratory/laboratory/...` links redirect in the app).
- Files in `assets/` have content hashes in their names and are cached for a year (`immutable`). A missing asset is a real 404, never `index.html`.
- `index.html` is served with `Cache-Control: no-cache`, so a new release is picked up. An open tab that meets a release it doesn't have reloads itself once.
- The CSP allows scripts only from the site plus the inline theme script by hash. Styles need `'unsafe-inline'` because the toast library injects its stylesheet at runtime.

Two builds of the same source are byte-identical, and production builds have no simulated API latency.

## Folder layout

```
src/
  app/          Shell (sidebar, header, command palette), providers, routes
  features/     One folder per screen area (orders, collection, results, reports, ...)
  components/   ui/ (design-system primitives), lab/ (laboratory widgets), charts/
  domain/       Types and pure rules
  mock/         In-browser backend: engine (rules), api (endpoints), db (store, seed)
  services/     The API seam, query and mutation hooks
  hooks/        Shared hooks (URL state, persistence, permissions, unsaved changes)
  i18n/         Translations and formatting
  lib/          Helpers (CSV, focus, storage, brand, colours)
  styles/       Global CSS, theme tokens, print styles, fonts
deploy/         Example nginx configuration (documentation)
scripts/        Packaging
```

Import across the app with the `@/` alias, which maps to `src/`.
