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

| Script              | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `npm run dev`       | Start the dev server with HMR                                             |
| `npm run build`     | Type-check, then build to `dist/`                                         |
| `npm run package`   | Build, then pack it for the server (see [Deploying](#deploying))          |
| `npm run preview`   | Serve the production build locally                                        |
| `npm run typecheck` | Run the TypeScript compiler (no emit)                                     |
| `npm run lint`      | Lint with ESLint (`lint:fix` to auto-fix)                                 |
| `npm run format`    | Format with Prettier (`format:check` for CI)                              |
| `npm test`          | Run Vitest in watch mode                                                  |
| `npm run test:run`  | Run the test suite once                                                   |
| `npm run test:perf` | Stress test at 10x the demo data (slow, about two minutes)                |
| `npm run coverage`  | Run tests with V8 coverage                                                |
| `npm run contract`  | Write the REST contract to `docs/api-contract.md` from the endpoint table |

Before finishing a change: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`.

## Environment

| Variable                  | Default                 | Purpose                                                      |
| ------------------------- | ----------------------- | ------------------------------------------------------------ |
| `VITE_DATA_SOURCE`        | `mock`                  | `http` builds against the laboratory backend (no mock code)  |
| `VITE_API_BASE_URL`       | `/api`                  | Base URL the HTTP client calls (`src/lib/env.ts`)            |
| `VITE_LOGIN_URL`          | `/login`                | The backend's sign-in page, for an ended session (http mode) |
| `VITE_LOGOUT_URL`         | `/logout`               | Ends the backend session (http mode)                         |
| `VITE_REQUEST_TIMEOUT_MS` | `20000`                 | Request timeout (http mode)                                  |
| `VITE_API_PROXY_TARGET`   | `http://localhost:4000` | Where the dev server forwards `/api` requests                |
| `BASE_PATH`               | `/dev/laboratory/`      | URL path the site is served under (build time)               |
| `SOURCEMAP`               | `false`                 | `true` emits unlinked source maps for debugging              |

No secrets belong in these variables: everything prefixed `VITE_` ends up in the public JavaScript.

## Architecture

`CLAUDE.md` in the repository root is the detailed guide. In short:

- `src/domain/`: types and pure rules (flags, reference intervals, workflow status derivation, TAT, permissions, glossary).
- `src/mock/`: the "backend in the browser". `engine/` holds every workflow rule (state transitions, role permissions, audit entries); `api/` exposes async endpoints returning DTOs; `db/` stores the data and replays a deterministic seed through the engine.
- `src/services/lab-api.ts`: the single seam the screens call. `queries.ts` and `mutations.ts` wrap it in TanStack Query.
- `src/features/<area>/`: one folder per screen area. `src/components/ui/` holds the design-system primitives and `src/components/lab/` the laboratory widgets.
- `src/i18n/`: typed translations (English, Hindi, Kannada, Tamil, Malayalam).

## Backend seam

The screens never talk to a data source directly. They import from `src/services/lab-api.ts`, which exports `labApi` and `demo` from `@/services/source`:

- **Default (`VITE_DATA_SOURCE=mock`)**: `services/source/mock.ts`, the in-browser demo backend (`src/mock/`).
- **`VITE_DATA_SOURCE=http`**: Vite resolves `@/services/source` to `services/source/http.ts` (`vite.config.ts`), the HTTP adapter. The mock is not bundled.

The contract is `LabApi` (`services/contract.ts`). The HTTP adapter builds it from the endpoint table `services/http/endpoints.ts`: one entry (method, path, how the arguments become path, query and body) per method. The table is typed against `LabApi`, so a method without an endpoint fails `npm run typecheck`. `npm run contract` writes the full table, with each call's arguments and response type, to `docs/api-contract.md`. `services/http/contract.test.ts` keeps the table and the mock in step.

What the HTTP client (`services/http/client.ts`) does on every request:

- `credentials: 'include'`: the server's session cookie authenticates. No token is stored in the browser.
- `X-Request-Id` on every request; `Idempotency-Key` on every write, so a retried write is applied once.
- Cancellation (`AbortSignal`) and a timeout (`VITE_REQUEST_TIMEOUT_MS`, default 20 s).
- Errors become `ApiError` (`domain/errors.ts`): the server answers an error status with `{ "code", "params", "requestId" }`, where `code` is one of `ERROR_CODES`, shown to the user in their language. Without a body, the status picks the code (401 `unauthenticated`, 403 `not-permitted`, 404 `not-found`, 409 `conflict`, 422 `validation-failed`, 429 `rate-limited`, otherwise `server-error`). A dropped connection is `network`; a slow one, `timeout`.

In http mode:

- **Who is signed in** comes from `GET /v1/session` (`labApi.session.get`). `app/session-gate.tsx` shows "Your session has ended" with a link to `VITE_LOGIN_URL` (returning to the page) when the server answers 401, from that call or any later one. Sign out opens `VITE_LOGOUT_URL`.
- **Demo-only controls disappear**: "acting as", simulated latency and failures, the demo notice, browser storage and reset (`demo.enabled` is false).
- **Long lists page on the server**: orders, patients, reports, the audit log and the work queue take `page`, `pageSize` (at most 200) and `sort` (a column key, `-key` for descending) and return `{ rows, page: { total, page, pageSize } }` (`mock/api/paging.ts` shows the expected behaviour). Exports ask for every matching row; a backend should stream those.
- **Sign-off screens never use a cached copy**: result entry, verification, the report and critical results refetch on opening and on focus.

The server must enforce, not the browser:

- **Who may do what.** The role permission matrix (`src/domain/permissions.ts`) and the signer rules: the authenticated user is always the performer and signatory; independent review; microbiologists authorise microbiology only. The browser only hides and disables; it never decides.
- **Workflow transitions.** Everything in `src/mock/engine/` (collection and receipt chronology, plausibility limits, reasons for changes, reruns, QC holds, critical-value read-back before release, preliminary, final, amended and withdrawn reports, corrections authorised by a pathologist).
- **The audit trail.** Append-only, written in the same transaction as the change, with who, what, when, before and after, and the reason. It must not be editable by any user. Access to personal health information is audited too: record views (`viewed`, once per person per record per half hour), prints and CSV exports (`exported`, needs `data.export`). The demo posts these to `POST /v1/audit/access`; a backend should also log views as it serves the records.
- **Identity and sessions.** Real login (with MFA for signatories and administrators), session expiry and server-side checks on every request. None of this exists in the demo.
- **Clinical safety rules** (Wave 1, all in `src/mock/engine/`, tested in `mock/api/clinical-safety.test.ts`):
  - Collection needs a two-identifier identity check, the fasting status for fasting tests, and recorded consent for tests flagged `consentRequired` (`engine/consent.ts`); a deferred collection taken early needs a reason.
  - Receipt records the temperature and flags a deviation from the tests' storage needs.
  - Aliquots (`splitSample`) keep at least one test on the parent; send-outs go only to active referral labs and name the lab on the report; an add-on past the specimen's stability gets a new specimen.
  - Calculated analytes are computed by the server (`domain/calculated.ts`), never accepted from the client.
  - Only a person on the signatory registry for the department may authorise (`isRegisteredSignatory`); the registry is managed with `signatory.manage`.
  - Patient identifiers: Indian mobile, optional PIN and ABHA; Aadhaar is never collected. Merging moves every record and leaves the duplicate read-only.
- **Share links and verification** (`engine/share.ts`): tokens are random (128 bits) and stored only as SHA-256; links expire, can be revoked, need the patient's date of birth (five failures lock for 30 minutes, and the attempt is saved before the refusal), keep an access log, and are revoked when the report is amended or withdrawn. Each issued version is sealed with a SHA-256 of its content and a random verification token (`/v/<token>`, no patient data). The public routes (`/v1/public/...`) need rate limiting.

- **Billing** (Wave 2, `engine/billing.ts`, tested in `mock/api/billing.test.ts`): one invoice per order; package and account prices; GST from settings (confirm rates with a tax adviser; lab services are often exempt); a discount above `billing.discountApprovalPct` waits for `billing.discount.approve` and blocks payment; card and UPI need a reference; credit stays within the account's limit; refunds never exceed what was received; only unpaid invoices can be cancelled; a closed day takes no more payments and a short or over count needs a reason. Revenue appears only for `revenue.view` (the server leaves it out of the response). **No payment is processed**: a backend connects a payment gateway and reconciles.
- **Network** (Wave 2, `engine/network.ts`, `engine/messaging.ts`, tested in `mock/api/network.test.ts`): doctors and collection centres (NABL 111: licence, in-charge, transit time, cold chain; unique codes); an inactive doctor takes no new orders. Home visits: slots from now to 30 days ahead, a 6-digit PIN, `home.dispatch` assigns, only the assigned phlebotomist moves a visit on, and collection needs proof (who signed, cold chain). Messages follow templates per event, channel and language; an active SMS template needs a DLT template id; opted-out channels are never used. **Nothing is sent**: every outbox entry is `not-sent` with its reason until a gateway (DLT SMS, WhatsApp Business, email) is connected.
- **Doctor portal** (`mock/api/doctor.ts`): a doctor sees only patients and released reports from their own orders; anything else is refused as `not-found`, including `reports.get`. The server must scope every read this way; the demo does not check permissions on other reads.
- **Quality system** (Wave 3, `engine/quality.ts`, tested in `mock/api/compliance.test.ts`): EQA z-scores (|z| at least 3 raises a non-conformance); CAPA steps each need their record and closing needs an effectiveness check by someone other than the owner; a controlled document version is authorised by someone other than its author and retires the previous one; auditors do not audit their own department and a nonconformity finding raises an NC; LIS verification compares at least 10 specimens and is reviewed by someone else; an out-of-range temperature needs the action taken.
- **Privacy** (`engine/privacy.ts`): data principals' requests have due dates (`dataRequestDays`); erasure cannot complete under a legal hold; incidents track the CERT-In 6-hour and Board 72-hour deadlines and close only when contained and reported. Retention per record class (`settings.retention`, NABL 112A Table 2 as floors) is enforced by the server's storage, not by the browser.
- **Interfaces and coding** (`engine/interfaces.ts`): test-code mappings are versioned; a failed message is retried only when its cause is fixed. LOINC codes on analytes and UCUM units (`domain/quality.ts`) feed ABDM FHIR bundles. All interface traffic in the demo is simulated.
- **Auto-verification** (`engine/autoverify.ts`): rules per test are authorised by a different signatory, always include the critical-value check, and only mark results; a person still authorises. The whole feature is off by default (`settings.autoVerifyEnabled`, the kill switch). No machine learning is used anywhere.
- **Suggestions and the assistant** (`mock/api/compliance.ts`, `mock/api/assistant.ts`): rule-based, with the evidence (why, data window, sources, rule version) and feedback audited. Assistant questions are audited by intent, never by the typed text, and refused while `settings.assistantEnabled` is off.
- **Modules and sites**: switched-off modules (`settings.modules`) leave navigation and their routes show a notice; the server should also refuse their endpoints. Orders carry `siteId` (missing means the main lab) and lists filter by it.

`src/mock/api/*.test.ts` describe the expected behaviour and can be reused as API contract tests.

Two seams are deliberately narrower than `labApi`:

- `services/assistant.ts`: the Lab Assistant panel talks only to `AssistantService` (`suggestions`, `ask`). Replies are structured (message keys with values, or plain text), so a backend or AI service can answer in the same shape.
- `services/report-files.ts`: returns a server PDF when one exists; until then, Download PDF prints the report and the browser saves it as PDF.

### Prepared, not implemented

These have data shapes and UI places ready but no real implementation:

- Share links and verification pages work only in the browser that made them (the demo's data lives there). The backend serves `/v1/public/share/:token` and `/v1/public/verify/:token` with the same rules.
- Patient and doctor portals: `PatientReportEntry` (laboratory and imaging reports per patient, newest first) is the list both portals will show.
- Imaging: studies and reports are demo data and read-only here. Scheduling, acquisition and reporting come from a RIS/PACS (DICOM, HL7) through the backend.
- Server-generated PDFs, SMS, email and WhatsApp delivery, payment gateways, analyzer interfaces (HL7/ASTM, simulated in the Interfaces screen), the ABDM gateway and a real AI assistant.

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
