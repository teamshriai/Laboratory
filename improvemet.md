# LABORATORY_MANAGEMENT_FULL_AUDIT.md

I could not inspect the live Laboratory Management app at https://www.shri-ai.org/dev/laboratory/laboratory or its source files during this audit, so nothing in this document describes the app's screens, fields or statuses as observed fact. What it does provide is (a) the small amount of verified evidence about the codebase, (b) a step-by-step verification protocol a Claude Code session with the source can run to build the real inventory, and (c) a standards-based target specification (ISO 15189:2022, CAP, Joint Commission practice, competitor LIS conventions) to measure the app against and build towards.

## TL;DR

- **Access result:** the research tool refused both the live URL and every file inside the public repo `teamshriai/Laboratory`. That repo contains only `client/`, `CLAUDE.md`, `DESIGN_SYSTEM.md`, `.claude/skills`, `.vscode` and `skills-lock.json`, with 3 commits and no `server/`. Sibling Shri `/dev/*` apps were converted to static front ends whose data lives in browser `localStorage`. If the Laboratory app follows the same pattern, it cannot enforce RBAC, a shared audit trail or multi-user data integrity. Verify this first.
- **Target model:** a credible hospital LIS has to separate Order → Specimen (accession) → Test/Result → Report, each with its own state machine. It must record collector, receiver, performer, verifier and authorizer, each with a time. It must hold critical-value notification records (date, time, lab person, recipient's full name, read-back) and produce reports that meet ISO 15189:2022 clause 7.4.1.6.
- **What to do:** Claude Code should first run the §2 verification protocol against the source to replace every "Not verifiable" cell. It should then build in roadmap order: Phase 1 is the safety-critical data model, state guards, critical-result workflow and report metadata; worklists, QC and UX polish come later. The work is done when the §31 checklist passes.

---

## 1. Executive Summary and Access / Methodology

### 1.1 What was attempted

| Target | Result |
|---|---|
| `https://www.shri-ai.org/dev/laboratory/laboratory` (user-supplied) and trailing-slash variant | **Refused by the research tool's URL-permission layer.** No request reached the site, so availability, HTML and JS bundles are unknown. |
| Site searches for `/dev/laboratory` | Returned only Shri-AI marketing pages (AI breast-cancer screening, "SHRI AI Bus"). The root title is "SHRI-AI \| Senus Healthcare Research Institute".\[1\] |
| GitHub `teamshriai/Laboratory` root | **OBSERVED:** public, branch `main`, **3 commits**, no description, no README rendered, empty Languages panel. Top level: `.claude/skills`, `.vscode/`, `client/`, `CLAUDE.md`, `DESIGN_SYSTEM.md`, `skills-lock.json`.\[2\] |
| `CLAUDE.md`, `DESIGN_SYSTEM.md`, `client/src/**` | **Not accessible.** Search only ever returned the repo root. |

### 1.2 Verified context from sibling Shri apps (inference, not proof)

- `teamshriai/procurement` PR #1 (merged 30 Sep 2026, co-authored by Claude) converted that portal "from React + Express + PostgreSQL into a static front end … (target: https://shri-ai.org/dev/procurement/, alongside the other /dev/* portals)". In that PR, `client/src/api.js` "now dispatches to `client/src/mock/`", data "is saved per browser in `localStorage`", a "Reset sample data" link was added, and the PR notes "Data is not shared between people or devices". It was verified at 1280px and 390px.\[3\]
- `teamshriai/care-entry` (SHRI HEALTH Care Entry Portal) is React + Vite + TypeScript, light theme by default with a dark switch, and deploys under a sub-path.\[4\]

**Inference (must be verified):** the Laboratory repo layout (only `client/`) matches this static-SPA pattern. **If confirmed, every control that matters for patient safety (RBAC, audit trail, e-signature, release locks) runs only on the client and can be bypassed.** That is acceptable for a demo, but the UI must say so.

### 1.3 Labels used

**OBSERVED** = verified evidence (here, limited to repo structure). **NOT VERIFIABLE** = must be checked in source using §2. **REQUIREMENT** = what the app should do. **REASON** = standard or operational rationale. Issue severities in §25 are conditional unless marked OBSERVED. No performance problem is claimed, because none was measured.

### 1.4 Standards baseline

- **ISO 15189:2022** §7.4.1: 7.4.1.6 report content items a–l; 7.4.1.5 automated selection/review (identifiable, reviewer and time retrievable, rapid suspension); 7.4.1.4 oral/preliminary reports; 7.4.1.8 revised reports; 7.4.1.1(b) notifying users when results are delayed.\[5\]\[6\]\[7\] NABL accredits Indian medical labs against ISO 15189.\[8\]
- **CAP** COM.30000 (notification records: date, time, responsible lab individual, person notified, where a first name alone is inadequate, and the result) and COM.30100 (read-back for phoned results).\[9\]\[10\]
- **The Joint Commission:** NPSG.02.01.01, as quoted in UF College of Medicine–Jacksonville's NPSG policy, requires that "for telephonic reporting of critical test results" the receiver "'read-back' the complete order or test result". The current goal, NPSG.02.03.01, requires labs to "Report critical results of tests and diagnostic procedures on a timely basis."

---

## 2. EXPLORATION – Inventory Verification Protocol

**OBSERVED:** no screens, routes, modals or tables could be enumerated. Every inventory item is **NOT VERIFIABLE from available access.** Claude Code must run these steps and append the output to this file:

1. Read `CLAUDE.md` and `DESIGN_SYSTEM.md`. Record the stack, design tokens and stated scope.
2. **Routes:** grep `client/src` for `createBrowserRouter`, `<Route`, `path:`, `useRoutes`, `basename`. List every path, including dynamic ones (`:id`). The user URL `/dev/laboratory/laboratory` suggests a base plus an inner route.
3. **Navigation:** copy every sidebar/topbar label verbatim, in order, with its target route.
4. **Pages:** per page record the title, tabs, tables (column headers verbatim), forms (labels, `required`, input `type`, validation), buttons with their handlers, modals/drawers/dialogs and toasts.
5. **Data layer:** open `client/src/mock/*`, `seed*`, `store*`, `api*`. Record entities, fields, ID formats and every status enum value verbatim, plus the persistence mechanism.
6. **Status logic:** find the functions that change status (`approve`, `verify`, `release`, `reject`, `setStatus`). Record the allowed transitions and any guards.
7. **Roles:** grep for `role`, `permission`, `isAdmin`, `user`. Record whether there is a login, a role switcher, or nothing.
8. **States:** find loading, empty and error components and the `try/catch` around data calls.
9. **Run** `npm i && npm run dev`. Walk every route at 1440/1280/1024/768/390/375 px and click every action, recording what happens.
10. **Seed sweep:** script the §8 rules D1–D14 over the seed data.

Inventory format to produce: `# | Element type | Name (verbatim) | Route/file | Trigger | Result of action | Notes`.

---

## 3. INFORMATION ARCHITECTURE

**Actual sitemap (OBSERVED only as far as the deployment path):**

```
https://www.shri-ai.org/dev/laboratory/      (assumed SPA base — verify basename)
└── /laboratory                               (user-supplied entry route — content NOT VERIFIABLE)
    └── [child routes NOT VERIFIABLE — enumerate per §2 step 2]
```

For each route Claude Code must record: name, route, parent nav, purpose, primary user, primary task, key info, actions, related pages, entry/exit points, missing navigation, confusing navigation, dead ends, redundant pages.

**IA rules to apply:**
1. Every Order ID, Accession No., UHID and Report ID shown anywhere links to its record. A plain-text ID that is not clickable is a dead end.
2. Detail pages show lineage: Patient › Order › Specimen › Result › Report.
3. No orphan routes and no placeholder nav items.
4. Replace the repeated `/laboratory/laboratory` segment by serving the Dashboard at the base path, unless the inner segment means something specific.
5. Refreshing a deep link under `/dev/laboratory/` must not 404. The procurement PR notes that hosting needs an SPA fallback (`try_files … index.html`).\[3\]

---

## 4. LAB WORKFLOW ANALYSIS

App status for every concept is **NOT VERIFIABLE**. Claude Code should mark each one Present / Partial / Absent. The requirement column is the specification.

### 4.1 Pre-analytical

| Concept | Minimum requirement | Reason |
|---|---|---|
| Patient registration | Look up by UHID, name+DOB or phone. Run a duplicate check before create. Store DOB, sex and UHID. | Beaker training material requires "at least TWO patient identifiers (name, DOB, MRN)" on specimens.\[11\] |
| Test ordering / verification | Order header (ordering clinician, location, priority, clinical notes) plus test lines from the catalog. Optional "Verify order" for transcribed paper requisitions. | ISO 7.4.1.6(c) requires the requester on the report.\[12\] |
| Sample collection | Collect action records **collector ID, date-time and container**. Labels print at collection. | The Epic Beaker ambulatory guide documents "collection date & time, and collector ID".\[13\] |
| Barcode / accession | Unique accession per container, rendered as Code 128/DataMatrix. | In Stanford's Beaker build "the specimen collection activity generates an accession number".\[14\] |
| Specimen type & container | Coded type and tube colour, derived from the catalog. | CrelioHealth: "Collection Vacutainers Based On Test & Sample Type". ISO 7.4.1.6(d).\[15\] |
| Transport | Optional "In transit" state with batch ID. | Needed for collection-to-receipt TAT. |
| Reception | Receive action captures receiver and time, with a scan input. | Beaker "Receiving" activity.\[16\] |
| Acceptance/rejection | Reason codes (haemolysed, clotted, QNS, mislabelled, wrong container, leaked, delayed), a note, and an automatic recollect request. | CrelioHealth can "sort or reject samples automatically based on predefined checks".\[17\] |
| Priority / STAT | Routine / Urgent / STAT. STAT is visually distinct and sorts first, with its own TAT measure. | Operational baseline. |

### 4.2 Analytical

| Concept | Minimum requirement |
|---|---|
| Worklists | Per-department queue of received but unresulted tests, STAT first, then oldest received. |
| Instrument / manual | Record the source (manual or named analyser) on each result. Interfaces are a Future item. |
| Test status | Per-test status separate from the order status (§9). |
| QC | Run log, Levey-Jennings chart, Westgard flags, release blocked on failure. Orchard offers "Levey-Jennings graphs and configurable Westgard Rules".\[18\] |
| Result entry/validation | Absurd-value limits, delta check, units locked to the catalog. |
| Repeat / dilution / reflex | Rerun keeps both values with a reason. Capture the dilution factor. Reflex rules are a Medium item. |
| Critical / abnormal | Catalog critical limits trigger a mandatory notification task. H/L/HH/LL text flags. |
| Reference ranges, units, method | Age-, sex- and specimen-specific. Snapshot them onto the result so later catalog edits do not change released reports. Show the method where relevant (ISO 7.4.1.6(f)).\[12\] |

### 4.3 Post-analytical

| Concept | Minimum requirement |
|---|---|
| Verification | Technical Verify by a technologist, recording verifier and time. |
| Authorization | Medical Authorize by a pathologist, shown on the report (ISO 7.4.1.6(j)).\[19\] |
| Report/release | Generated from authorized results only. Partial reports are labelled "Preliminary" (7.4.1.6(k)).\[19\] |
| Amendment | A new version with a reason, an "AMENDED REPORT" header, the prior version retained, and the clinician notified (7.4.1.8).\[6\] |
| Critical communication | Notification log meeting CAP COM.30000/30100 (§19 D). |
| Clinician/patient access | Doctor or patient view, or a QR-verified PDF. Drlogy offers "QR Code Based Lab Reports Access".\[20\] |
| Audit trail | Append-only log of who, what, when, before→after and reason. Orchard lists "audit trail, statuses, and sample tracking" as core.\[21\] |

---

## 5. ROLES AND RBAC

**OBSERVED:** nothing. Claude Code must state explicitly whether any login, role or permission concept exists. **If storage is browser-local (§1.2), RBAC can only be simulated with a role switcher, not enforced.**

| Role | Needs to see | Allowed | NOT allowed | Restrict / approvals |
|---|---|---|---|---|
| Lab Administrator | Users, roles, catalog, audit log | Manage users, catalog, ranges, critical limits | Enter, verify or authorize results | Catalog changes logged with reason |
| Lab Manager | TAT, workload, rejections, QC failures, queues | Reassign work, view all, export | Edit authorized results | — |
| Reception / Registration | Demographics, orders | Register patient, create/verify orders, print requisitions | Verify/authorize; result values (policy) | Results |
| Phlebotomist / Collection staff | Pending collections, ID, containers | Print labels, Collect, Unable to collect (reason) | Receive, enter results | Results |
| Lab Technician | Department worklist, specimen, QC | Receive/reject, enter results, rerun | Authorize, release, amend | Other departments (configurable) |
| Senior Technician | Plus pending verifications | Verify others' results, approve reruns, review QC | Medical authorization unless delegated | — |
| Pathologist | Authorization queue, criticals, history, delta | Authorize, comment, amend with reason, release | Delete results; edit without an amendment | E-signature on amendments |
| Microbiologist / Biochemist / Haematologist | Own-discipline queue | Authorize own discipline; prelim/final culture reports | Authorize outside discipline | — |
| Clinician | Released reports for own patients, critical alerts | Order, acknowledge criticals | See unreleased results, edit lab data | Other patients |
| Hospital Administrator | Aggregate KPIs only | View/export aggregates | Patient-level results | PHI |

**Reason:** separating performer, verifier and authorizer is what lets the report identify who reviewed and authorized it (ISO 7.4.1.6(j)).\[19\] At one academic Beaker site, residents "participate in the sign-out process but cannot final verify" electrophoresis results.\[14\]

---

## 6. FIELD-LEVEL AUDIT (target; "Current Purpose" = NOT VERIFIABLE for all rows)

| Field | Appropriate? | Required? | Validation | Missing/Extra risk | Recommendation |
|---|---|---|---|---|---|
| UHID / MRN | — | Yes | Unique, immutable | Also labelled "Patient ID" | Use one label, "UHID". Show it in every patient header. |
| Patient name | — | Yes | Non-empty | — | One display convention everywhere. |
| DOB / Age | Age derived only | DOB yes | Not future; ≤120 y | Age stored without DOB | Store DOB and derive age ("34 Y", "8 M", "12 D"). Stored age breaks age-specific ranges. |
| Sex | — | Yes | M/F/Other/Unknown | — | Needed for reference intervals. |
| Order ID | — | Yes | Generated, unique | — | Prefix `ORD-`, always a link. |
| Accession No. / Specimen ID | — | Yes, per container | Unique, barcodeable | "Sample ID" and "Accession" with different meanings | One identifier, "Accession No." |
| Test name/code | — | Yes | Catalog only | LOINC absent | Internal code plus optional LOINC (ISO 7.4.1.6(f) note).\[12\] |
| Specimen type | — | Yes | Catalog | — | Show on specimen, result and report. |
| Collected at/by | — | Yes | ≤ now, ≥ ordered | Collector missing | Auto-fill from the user. Edit only with a reason. |
| Received at/by | — | Yes | ≥ collected | — | Captured by the Receive action. |
| Resulted/Verified/Authorized/Released at+by | — | Yes | Chronological | One generic "Updated at" | Separate fields. |
| Result value | — | Yes | Type per catalog, absurd limits | — | Keep precision per test. |
| Units | — | Yes | Locked to catalog | Free text | Next to every value (7.4.1.6(g)).\[12\] |
| Reference interval | — | Yes (quantitative) | Age/sex-specific | — | Label "Reference interval". Snapshot onto the result. |
| Flag / Critical flag | Derived | Derived | From limits | Typed manually | Text plus colour. A critical flag opens the notification task. |
| Status | — | Yes | Enum per entity | One status shared across entities | Separate enums (§9). |
| Priority | — | Yes | Routine/Urgent/STAT | "High/Low" | Default Routine. |
| Ordering physician | — | Yes | Practitioner master | — | On the report (7.4.1.6(c)).\[12\] |
| Performing lab / dept | — | Yes | — | — | On the report (7.4.1.6(b)). Mark referred tests.\[12\] |
| Technician / Reviewer / Authorizer | — | Yes | Authorizer ≠ performer (policy) | — | Authorizer's name and qualification on the report. |
| Report ID / version / issue date / page x of y | — | Yes | — | Likely missing | Required on every page (7.4.1.6(a)).\[12\] |

---

## 7. TERMINOLOGY AUDIT (rules; current usage NOT VERIFIABLE)

| Term pair | Rule | Reason |
|---|---|---|
| Specimen vs Sample | Use "Specimen" in clinical UI. "Sample" only for aliquots/QC. | Beaker and Orchard use "specimen". Mixing the two implies two entities. |
| Order vs Request | "Order"; "requisition" for the paper form only. | Beaker, Orchard and HL7 ORM/OML. |
| Result vs Report | Result = one analyte value. Report = the issued document. | Different lifecycles. |
| Verified / Approved / Authorized / Released | Verified = technical. Authorized = medical. Released = visible to the clinician. Drop "Approved". | The CAP TODAY Q&A column describes "three distinct activities: 1) verifying the critical value, 2) releasing the critical value, and 3) notifying a responsible provider". |
| Pending vs Processing | Replace bare "Pending" with stage-specific labels ("Awaiting receipt", "Awaiting verification"…). | A verified reviewer on Software Advice (daily user for more than 2 years, January 2018) wrote: "Harvest is limited in that it shows thousands of samples are pending, yet it can be only hundreds." |
| Rejected vs Cancelled | Rejected = specimen failed acceptance. Cancelled = order/test withdrawn. Both need reasons. | Different owners and consequences. |
| Critical vs Abnormal | Abnormal = outside the reference interval. Critical = beyond critical limits, needs immediate notification. | TJC: a value "that requires immediate communication".\[10\] |
| Reference vs Normal range | "Reference interval" only. | ISO/CLSI term. |
| Patient ID / UHID / MRN | One primary label, UHID. | Duplicate labels create wrong-patient risk. |
| Accession Number | The per-specimen lab ID. Never reuse it as the Order ID. | Beaker. |
| STAT / Priority | Label "Priority"; values Routine/Urgent/STAT. | Clinical convention. |

---

## 8. DATA LOGIC – Rules to enforce and test against seed data

| # | Rule |
|---|---|
| D1 | Order "Completed" ⇒ all non-cancelled tests have authorized results. Completed is derived only. |
| D2 | A result exists ⇒ it links to a received specimen. |
| D3 | A specimen exists ⇒ it links to an order line. |
| D4 | Report released ⇒ all included results are authorized, with authorizer and time. |
| D5 | `orderedAt ≤ collectedAt ≤ receivedAt ≤ resultedAt ≤ verifiedAt ≤ authorizedAt ≤ releasedAt`. |
| D6 | No future timestamps; none before DOB. |
| D7 | UHID, Order ID, Accession No. and Report ID+version are unique. |
| D8 | Rejected specimen ⇒ no results; reason, user and time recorded; recollection linked. |
| D9 | Cancelled test ⇒ no result entry; reason recorded. |
| D10 | Every quantitative result has a unit and a reference interval (or "Not established"). |
| D11 | Patient demographics are joined from one source and identical on every screen. |
| D12 | Critical result ⇒ a notification record exists or an open task is visible. |
| D13 | Amended report ⇒ prior version retained; reason, user and time recorded. |
| D14 | Displayed age is derived from DOB. |

---

## 9. STATE-TRANSITION MODELS (target; reconcile with actual enums)

**Order:** Draft → Placed → In progress (derived, on first receipt) → Partially reported (derived) → Completed (derived, all non-cancelled tests released). Cancel is allowed from Draft or Placed with a reason; it is terminal and is fixed by re-ordering. Delete is allowed only in Draft. **Block:** setting Completed manually; Placed → Completed with no results; reopening a Cancelled order.

**Specimen:**

| State | By | Required info | Next |
|---|---|---|---|
| Awaiting collection | System | Container, type | Collected, Not collected |
| Collected | Phlebotomist | Collector, time | In transit, Received |
| Not collected | Phlebotomist | Reason | Awaiting collection |
| In transit (optional) | Courier | Batch ID | Received |
| Received | Lab | Receiver, time, condition | In process, Rejected |
| Rejected | Lab | Reason code, note | Terminal; spawns a recollection specimen |
| In process | Technician | Bench/instrument | Stored/Disposed |

A rejected specimen is never reused. A new specimen gets a new accession linked via `recollectionOf`; the ward is notified and the order stays open. Beaker supports a new collection "without requiring the provider to reorder the test".\[22\]

**Test/Result:** Ordered → In progress (specimen received) → Resulted (value, unit, performer; a critical value opens a notification task) → Verified (verifier) → Authorized (authorizer, e-sign) → Released (via report) → Amended (reason, new version, clinician notified). Side paths: Resulted → Rerun requested (reason; both values kept) → Resulted; Verified → Returned to technician; Ordered or In progress → Cancelled (reason). **Autoverification (Future):** results selected for manual review must be identifiable, with reviewer and time retrievable, and there must be a rapid-suspension switch (ISO 7.4.1.5).\[5\]

**Report:** Draft → Preliminary (optional) → Final → Amended vN, plus Withdrawn with a reason. A Final report is never edited in place.

Every transition writes an audit event recording who, when, from→to and reason.

---

## 10. EDGE CASES (observed behaviour NOT VERIFIABLE for all)

| Case | Required behaviour |
|---|---|
| No data / one record / thousands | Role-appropriate empty state with the primary action; layout stable with one row; pagination or virtualization with counts matching filters. |
| Search: none / many | "No match for 'X' in UHID, name, order, accession" plus Clear; an exact ID match is pinned first. |
| Empty or invalid fields; duplicates | Inline errors, focus moves to the first error; duplicate-patient warning on name+DOB+sex. |
| Cancel / back / refresh | Unsaved-changes prompt; deep-link refresh works. |
| Storage/network failure, slow load | Local storage: handle quota errors and corrupt JSON with a reset prompt. Remote: retry banner and skeletons. |
| Deleted record | Clinical records are voided or cancelled with a reason, never hard-deleted. |
| Completed/released record | Read-only; only "Amend", and only for an authorized role. |
| Abnormal / critical result | H/L flag in the authorization queue; a critical result raises a banner, a dashboard tile and a required notification form. |
| Rejected sample / cancelled test | Reason visible on order, specimen and patient timeline; recollect task created; a cancelled test is struck through and excluded from completion. |
| Amended report | "AMENDED" banner, version history, changed values highlighted. |
| "Reset sample data" (sibling pattern) | Confirmation dialog; admin-only.\[3\] |

---

## 11. TABLE AUDIT

For each table Claude Code must record: columns verbatim, order, sort, filters, search, pagination, density, badges, row and bulk actions, export, column visibility, empty/loading/error states, responsive behaviour, long text, date/number formats, units, accessibility. **Standards:**
1. Worklist columns: Priority · Accession No. · Patient (Name, UHID, Age/Sex) · Test(s) · Specimen type · Received · Status · Time in queue · Action.
2. Default sort: STAT first, then oldest first.
3. Badges combine text, colour and icon, with one vocabulary per entity.
4. The row's primary action names the next step ("Receive", "Enter results", "Verify", "Authorize"), not "View".
5. Bulk actions: receive, verify (normal results only), print labels. CSV export for managers (the procurement sibling already ships CSV export).\[3\]
6. Dates `DD-MMM-YYYY HH:mm`, 24-hour, everywhere. Numbers right-aligned with units.
7. Below 768px, rows become stacked cards with priority, patient, test, status and action.
8. `<th scope>`, `aria-sort`, `<caption>`.

---

## 12. FORM AUDIT

Field order follows the workflow (patient → order details → tests → priority → notes). Required fields have an asterisk plus text. Defaults: Routine priority; collection time = now (editing needs a reason); collector = current user. Validation runs on blur and on submit, with messages that say how to fix ("Collection time cannot be after receipt time (14:05)"). Date-time pickers accept keyboard entry. Test selection is a searchable multi-select by name, code or synonym, with panels. Patient lookup autocompletes by UHID, name or phone. Save/Cancel sit in a fixed footer. An unsaved-changes guard is on. Reject, Cancel and Amend require confirmation with a reason. A success toast is followed by the next step (after creating an order: "Print labels / Collect now"). Current forms: NOT VERIFIABLE.

---

## 13. DASHBOARD AUDIT

Current dashboard: NOT VERIFIABLE. **Rule: every tile is a count of items that need action, and clicking it opens the filtered queue.** Required tiles, filtered by role: (1) critical results awaiting notification, always first and red; (2) STAT not yet resulted, with the oldest age; (3) collected but not received beyond the threshold; (4) rejected specimens awaiting recollection; (5) awaiting verification; (6) awaiting authorization; (7) authorized but unreleased, or delayed beyond the TAT target (ISO 7.4.1.1(b)); (8) QC failures blocking release. Secondary: segmented TAT. Stanford's Beaker paper (Am J Clin Pathol 2017;147(3):261–272) reports that before Beaker the 90th-percentile METC TAT "ranged from 60 to 80 minutes, with 20 to 30 minutes for the receive-to-bench (preanalytic) time and 40 to 60 minutes for the bench-to-verify (analytic) time"; in September 2015 the receive-to-bench target was cut from 15 to 10 minutes. Also show workload by department and rejection rate by reason. A dashboard that shows only totals is statistics-only (MEDIUM).

---

## 14. SEARCH & FILTERING

Requirement: one global search (shortcut `/`) that detects the identifier type. A barcode scan resolves to an accession, `ORD-…` to an order, the UHID pattern to a patient, and anything else to a name search, with results grouped by entity. List filters (status, priority, department, date range, physician, test) combine, appear as removable chips and persist in the URL. Target: any known identifier resolves in under 3 seconds with one scan or paste. Current capability: NOT VERIFIABLE.

---

## 15. REPORTING AUDIT (ISO 15189:2022 §7.4.1.6; current = NOT VERIFIABLE)

Required on the printable report: (a) unique patient ID, primary-sample collection date and report issue date **on every page**; (b) issuing lab identity; (c) requesting user; (d) primary sample type and descriptors; (e) clear examination identification; (f) method where relevant (LOINC optional); (g) results with units; (h) reference intervals or decision limits; (i) research-use identification if applicable; (j) reviewer and authorizer; (k) preliminary results identified; (l) critical results indicated.\[12\]\[19\] Also required: page x of y, report ID and version, and "AMENDED" marking with reason (7.4.1.8). Recommended: interpretive comments, a disclaimer, and QR verification (the Indian market norm).\[23\]

Layout: lab header → patient block (Name, UHID, Age/Sex, Ordering physician, Location) → specimen block (Accession, Type, Collected, Received, Reported) → results by department (Test | Result | Flag | Unit | Reference interval | Method) → comments → signatories (name, qualification, e-signature, time) → footer (page x/y, ID/version, "End of report").

---

## 16. VISUAL UX

Audit how closely the UI follows `DESIGN_SYSTEM.md` (tokens versus hard-coded values). Fix status colours app-wide: red = critical/rejected, amber = abnormal/delayed, blue = in progress, green = released, grey = cancelled. Never use red as decoration. Worklist rows should be compact (36–40px, 13–14px text). Use tabular numerals for results and IDs. Every patient-scoped screen gets a persistent identity banner (Name · UHID · Age/Sex). Sibling apps ship light and dark themes, so check status contrast in both.\[4\] Avoid generic SaaS decoration. Current visuals: NOT VERIFIABLE.

---

## 17. RESPONSIVENESS

All widths are NOT VERIFIABLE. Check: **1440/1280**: full columns, expanded sidebar (the procurement sibling was verified at 1280px).\[3\] **1024**: icon sidebar, low-priority columns hidden. **768**: tablet bench use, touch targets ≥44px, usable scan-to-receive. **390/375**: nav drawer (the sibling shows its logo in a top bar below 980px), card tables, full-screen modals, sticky action footer, no hidden primary actions.\[3\]

---

## 18. ACCESSIBILITY (WCAG 2.2)

Every action is keyboard-reachable with a visible, unobscured focus (2.4.7, 2.4.11). Use semantic landmarks and a `<label>` for every input. Text contrast ≥4.5:1 and badge/icon contrast ≥3:1. Flags must not rely on colour alone (1.4.1): H/L/HH/LL text is mandatory. Dialogs trap focus, close on Esc and return focus. Errors are linked with `aria-describedby` and announced with `aria-live`. Targets ≥24×24px (2.5.8). Nothing requires dragging (2.5.7). Tables use `th`/`scope`. Run axe-core on every route. Current conformance: NOT VERIFIABLE.

---

## 19. USER JOURNEYS (target steps; break points to record after the walkthrough)

**A. New order → Report:** find/register patient → create order → print labels → Collect (collector/time) → Receive (scan) → worklist → enter result → Verify → Authorize → Release. *Check for:* missing collector/time, no receive step, results enterable before receipt, no authorizer, report missing ISO elements.

**B. Patient search → Report:** global search by UHID → patient timeline (orders, specimens, results, reports) → drill down to the report. *Check:* is the patient page a hub, or do IDs dead-end?

**C. Abnormal result:** entry → automatic H/L flag → authorization queue sorted by flag → authorize → release. *Check:* is the flag computed from the stored interval?

**D. Critical result:** entry → automatic critical flag → banner and dashboard tile → confirm or rerun per policy → **notification form: recipient full name and role, date/time (auto), lab person (auto), method, read-back confirmed (required for phone), comment; or "Unable to reach" → escalation** → release (the CAP TODAY Q&A column: "Releasing the value and notifying the provider are independent actions that can be performed in any order") → audit. Scripps Health laboratory policy S-LAB-PC-15600 ("Critical Results of Tests") requires staff to "Initiate notification of critical test results within 5 minutes of availability" and to report "verbally or on a hard copy in person with two (2) patient identifiers." Make notification time a KPI.

**E. Rejected specimen:** Receive → Reject (reason) → order shows "Recollection required" → recollect task in the collection list → new linked accession → processing.\[24\] *Check:* does rejection dead-end the order?

For each journey record: step, screen, whether it worked, where it broke, and why.

---

## 20. MISSING / RECOMMENDED CAPABILITIES (confirm absence in Phase 0)

- **Critical:** separate entities with guarded state machines; collector/receiver/verifier/authorizer capture; critical-result notification log; ISO-compliant, versioned reports; rejection with reasons and recollection; catalog-driven units, intervals and critical limits; a "Demo data – not for clinical use" banner if storage is local.
- **High:** department worklists; ID-aware global search; patient timeline; role switcher/RBAC; append-only audit log; STAT handling; TAT timers; Code 128 labels.
- **Medium:** QC (L-J, Westgard); delta checks; reflex rules; CSV export; delayed-result notifications; catalog admin.
- **Future:** analyser/HL7 interfaces; autoverification with a suspension switch; doctor/patient portal; QR verification; WhatsApp/SMS delivery (Drlogy, CrelioHealth);\[20\]\[25\] multi-centre support; billing.

---

## 21. REDUNDANT FEATURES (to look for)

Duplicate Samples/Specimens pages; Results and Reports pages showing the same rows; dashboard tiles repeating one count under different names; demographics retyped instead of joined; several status vocabularies for one entity; "View" and "Details" buttons that do the same thing. Rule: one entity, one detail page, one status enum, one label. Findings: NOT VERIFIABLE.

---

## 22. MICROCOPY

| Context | Use | Avoid |
|---|---|---|
| Actions | "Collect", "Receive specimen", "Reject specimen", "Request recollection", "Enter results", "Verify", "Authorize", "Release report", "Amend report", "Log critical call" | "Submit", "Approve", "Done", "Process" |
| Empty | "No specimens awaiting receipt." | "Nothing here!" |
| Error | "Received time (13:50) is earlier than collected time (14:05)." | "Invalid input" |
| Confirm | "Reject specimen ACC-000123? A recollection request will be sent to Ward 4B." | "Are you sure?" |
| Success | "Report RPT-0456 released to Dr. A. Rao." | "Success!" |
| Critical | "CRITICAL: Potassium 6.9 mmol/L — notify clinician and log the call." | "Alert" |

---

## 23. PERFORMANCE-RELATED UX

**Observed performance problems: none claimed, because nothing was measured.** Potential engineering improvements: (1) if all data sits in one `localStorage` JSON blob, as in the procurement sibling, every write reserializes the whole blob, so measure with thousands of records before growing the seed;\[3\] (2) virtualize tables above about 200 rows; (3) debounce search by 150–250 ms; (4) use skeletons on first paint; (5) lazy-load the report/PDF and chart modules; (6) compare `client/dist` against the procurement sibling's "6 files, 528 KB".\[3\]

---

## 24. CONSISTENCY AUDIT

Grep for variants in each family: `Sample|Specimen`, `Approved|Verified|Authorized|Released`, `Pending`, `Patient ID|UHID|MRN`, `Normal Range|Reference`. Unify date formatting (`toLocaleDateString`, `format(`) behind one helper. Inventory button, icon, modal and badge variants. Any family with more than one variant is a finding. Results: NOT VERIFIABLE.

---

## 25. ISSUE REGISTER

| ID | Area | Screen | Severity | Observation | Problem | Recommendation |
|---|---|---|---|---|---|---|
| LAB-001 | Architecture/Safety | Global | HIGH (structure OBSERVED; impact conditional) | Only `client/`, no `server/`; sibling `/dev/*` apps use per-browser `localStorage` | If the same here: no shared data, no enforced RBAC or audit | Confirm. Add a persistent "Demo – data stored in this browser only" banner and keep the data layer behind an API interface\[2\]\[3\] |
| LAB-002 | Docs | Repo | LOW (OBSERVED) | No README/description; 3 commits | Scope and run steps unclear | Add a README covering run, `/dev/laboratory/` build, data model and demo limits\[2\] |
| LAB-003 | Routing | Live URL | MEDIUM (conditional) | `/laboratory/laboratory` inner route | Repeated segment; deep-link 404 risk | Serve the dashboard at the base; add SPA fallback; test refresh |
| LAB-004 | Data model | Orders/Specimens | CRITICAL (if confirmed) | NOT VERIFIABLE | Order and specimen merged | Split entities (§9) |
| LAB-005 | Workflow | Result entry | CRITICAL (if confirmed) | NOT VERIFIABLE | Results before receipt | Guard D2 |
| LAB-006 | Workflow | Report | CRITICAL (if confirmed) | NOT VERIFIABLE | Release without authorization | Guard D4; separate Verify/Authorize/Release |
| LAB-007 | Safety | Critical results | CRITICAL (if confirmed) | NOT VERIFIABLE | No critical flag or notification log | §19 D with CAP fields |
| LAB-008 | Reporting | Report | HIGH (if confirmed) | NOT VERIFIABLE | ISO 7.4.1.6 elements missing | §15 layout |
| LAB-009 | Data | Results | HIGH (if confirmed) | NOT VERIFIABLE | Units/intervals missing or free text | Catalog-driven, snapshotted |
| LAB-010 | Workflow | Specimen | HIGH (if confirmed) | NOT VERIFIABLE | Rejection without reason or recollection | §19 E |
| LAB-011 | Data | Seed | HIGH (if confirmed) | NOT VERIFIABLE | Impossible timestamp order | Fix seed; enforce D5 |
| LAB-012 | Identity | All | HIGH (if confirmed) | NOT VERIFIABLE | Inconsistent patient info | Join from one source (D11); identity banner |
| LAB-013 | RBAC | Global | HIGH (if confirmed) | NOT VERIFIABLE | Anyone can authorize | §5 roles (simulated until backend) |
| LAB-014 | Audit | Global | HIGH (if confirmed) | NOT VERIFIABLE | No audit trail | Append-only event log |
| LAB-015 | Terminology | Global | MEDIUM (if confirmed) | NOT VERIFIABLE | Mixed terms | §7 glossary constants file |
| LAB-016 | Dashboard | Dashboard | MEDIUM (if confirmed) | NOT VERIFIABLE | Statistics-only tiles | §13 action tiles |
| LAB-017 | Search | Global | MEDIUM (if confirmed) | NOT VERIFIABLE | No cross-ID search | §14 |
| LAB-018 | Tables | Lists | MEDIUM (if confirmed) | NOT VERIFIABLE | Unusable at 375px | Cards below 768px |
| LAB-019 | A11y | Global | MEDIUM (if confirmed) | NOT VERIFIABLE | Colour-only flags | Text flags plus ARIA |
| LAB-020 | States | Global | MEDIUM (if confirmed) | NOT VERIFIABLE | No empty/error/storage-failure states | §10 |
| LAB-021 | Data control | Sidebar | MEDIUM (if confirmed) | Sibling exposes "Reset sample data" | Unconfirmed data wipe | Confirm dialog; admin-only\[3\] |
| LAB-022 | Visual | Global | LOW (if confirmed) | NOT VERIFIABLE | Inconsistent dates/badges | One formatter and one badge component |

---

## 26. SCREEN-BY-SCREEN SPECIFICATION (target screens; map existing screens onto them in Phase 0)

For each existing screen Claude Code fills in Current Purpose, Intended User, Current Elements, What Works, Problems, Missing/Incorrect Information, Workflow/UX/Data Issues. The targets and acceptance criteria are:

1. **Dashboard** – action tiles (§13). *Accept:* each tile count equals its queue count; critical tile first; every tile is clickable.
2. **Patients** – list plus a detail page with identity banner and a linked timeline. *Accept:* UHID search opens the record in one step; duplicate warning; edits are audited.
3. **Orders** – create (patient autocomplete, test multi-select, priority, physician, notes) and detail (per-test status, linked specimens, cancel with reason). *Accept:* cannot submit without patient, test and physician; status derived.
4. **Collection** – pending collections, print labels, Collect / Unable to collect. *Accept:* collector and time auto-captured; future times rejected.
5. **Specimen Reception** – scan field focused on load, Receive / Reject with reason. *Accept:* received ≥ collected; rejecting creates a recollection.
6. **Worklists** – STAT-first queue per department; entry grid with units and intervals pre-filled; automatic flags; rerun. *Accept:* no entry for unreceived or cancelled tests; a critical value opens the notification task.
7. **Verification/Authorization** – abnormal and critical first, delta shown, Verify / Return / Authorize. *Accept:* authorizer ≠ performer when the policy is on; audit written.
8. **Critical Results log** – open and closed notifications with CAP fields. *Accept:* cannot close without recipient full name, time and read-back (phone); escalation available.
9. **Reports** – ISO layout, Preliminary/Final/Amended, versions. *Accept:* all §15 elements present; amendment keeps the prior version and requires a reason.
10. **Test Catalog (admin)** – code, name, LOINC, department, specimen, container, unit, intervals by age/sex, critical limits, method, TAT target. *Accept:* versioned; released results unaffected.
11. **QC** (Phase 4) – runs, L-J chart, Westgard flags, release block.
12. **Analytics** – TAT segments, rejection rate, workload. **Administration** – users, roles, audit-log viewer, admin-only reset.

---

## 27. IDEAL END-TO-END LAB WORKFLOW

1. **Order:** reception identifies the patient by UHID (≥2 identifiers) and orders tests with physician and priority. The system derives the specimens and containers needed.
2. **Labels:** name, UHID, DOB/age, test, container colour, accession barcode.
3. **Collection:** scan, confirm identity, Collect. Collector and time are captured.
4. **Accession/Reception:** scan, then Receive (condition OK) or Reject with a reason, which triggers recollection.
5. **Analysis:** department worklist, STAT first, QC passing.
6. **Result:** units, interval and flags applied automatically. A critical value opens the notification task.
7. **Verification:** technical verify by a technologist.
8. **Authorization:** pathologist e-signs, with comments.
9. **Report/Release:** ISO 7.4.1.6 content; partial reports marked Preliminary.
10. **Critical communication:** logged with CAP fields, in either order relative to release.
11. **Amendment:** versioned, clinician notified.
12. **Audit:** immutable log of every step; dashboard shows segmented TAT.

---

## 28. TARGET INFORMATION ARCHITECTURE

```
Dashboard · Patients · Orders · Collection · Specimen Reception · Worklists ·
Verification (Technical | Authorization) · Critical Results · Reports ·
Quality Control (Phase 4) · Analytics · Administration (Test Catalog, Users & Roles, Audit Log, Settings)
```

**Rationale:** the nav follows the physical specimen journey, so each role's work sits in one place: phlebotomists in Collection, the front bench in Reception, technologists in Worklists, pathologists in Verification and Critical Results. Critical Results is top-level because it is a CAP/TJC safety obligation, not a report. The catalog sits under Administration because it changes rarely and needs restricted access. Nav items are hidden per role (§5).

---

## 29. COMPETITOR COMPARISON

### 29.1 Evidence (named sources)

- **Epic Beaker:** Stanford's implementation paper (American Journal of Clinical Pathology) lists content built for "orders, results, test records, autoverification logic, quality control, call workflows, specimen storage, tracking". Collection generates the accession number. Technologists can request a new collection without a reorder. TAT is split into receive-to-bench and bench-to-verify.\[22\] A Northwestern ambulatory guide uses the labels "Print Labels", "Collect All", "Receive", "New Collection" and "Use Existing Specimen".\[13\]
- **Clinisys/Orchard Harvest:** "audit trail, statuses, and sample tracking … throughout all phases"; rules-based decision support and auto-verification; Levey-Jennings and Westgard rules; Code 128, DataMatrix and other barcodes (CAP TODAY product guide).\[18\]\[21\]\[26\] The "#1 client-rated in Black Book seven consecutive years" ranking is a vendor-reported marketing claim.\[27\]
- **CrelioHealth (LIVEHEALTH):** "pending accession dashboard", containers by test and sample type, barcoding, archival, "multi-view operational dashboard", mobile report approval/signing/dispatch, role-based access, audit trail, automatic rejection on predefined checks.\[15\]\[17\]\[28\]\[29\]\[30\]
- **Attune LIS:** "Batch & Patient wise Sample Accession", "Mobile and Auto-Authorization", mobile phlebotomy, HL7, device interfacing, dispatch/logistics.\[31\]
- **Drlogy:** QR report access, "5+ Doctors Digital Signature in Report", collection-centre portal, WhatsApp/mail sharing.\[20\]\[23\] "30,000+ labs" is a vendor claim.\[32\]
- **Not researched this session (no claims made):** Oracle Health PathNet, SCC Soft Computer, LabWare, STARLIMS, Sunquest, Suvarna/Healthray, MocDoc, Labsmart.

### 29.2 Labels to adopt

Accession · Collect / Collect All · Print Labels · Receive · Reject · Recollect / New Collection · Add-on (Use Existing Specimen) · Result Entry · Verify · Authorize · Release · Amend / Corrected Report · Critical Call · Worklist · Rerun · Dispatch.

### 29.3 Feature matrix

| Capability | Beaker | Orchard | CrelioHealth | Attune | Drlogy | Shri-AI Lab |
|---|---|---|---|---|---|---|
| Barcode accession | Yes | Yes | Yes | Yes | Yes | NOT VERIFIABLE |
| Separate receive step | Yes | Yes | Yes | Yes | Unclear | NOT VERIFIABLE |
| Reject + recollect | Yes | Statuses/tracking | Auto-reject | Not sourced | Not sourced | NOT VERIFIABLE |
| Auto-verification/authorization | Yes | Yes | Not sourced | Yes | No evidence | NOT VERIFIABLE |
| QC (L-J/Westgard) | Yes | Yes | Listed | Not sourced | Generic | NOT VERIFIABLE |
| Critical call workflow | Yes | Not sourced | Not sourced | Not sourced | Not sourced | NOT VERIFIABLE |
| RBAC + audit trail | Yes | Yes | Yes | Yes | User mgmt | NOT VERIFIABLE; likely client-only |
| Operational/TAT dashboard | Yes | Yes | Yes | MIS | Tracking | NOT VERIFIABLE |
| Digital signature on report | Yes | Yes | Yes | Yes | Yes | NOT VERIFIABLE |
| Portal / QR / WhatsApp | MyChart | Webstation | Yes | Dispatch | Yes | NOT VERIFIABLE |
| Instrument/HL7 interfaces | Yes | Yes | Yes | Yes | Claimed | Absent if static SPA (inferred) |

### 29.4 Best practices to adopt

1. Accession at collection plus scan-to-receive (Beaker, CrelioHealth).
2. Recollect without reorder (Beaker).
3. Action-queue dashboards with accurate counts (CrelioHealth; the Orchard review lesson).
4. Separate Verify and Authorize, with role-restricted final verification (Beaker sites).
5. Segmented TAT (Stanford).
6. Westgard QC gating release (Orchard).
7. Multi-signatory, QR-verified, digitally delivered reports for India (Drlogy, CrelioHealth).

---

## 30. PRIORITIZED IMPLEMENTATION ROADMAP

- **Phase 0 – Discovery (mandatory):** run §2, fill every NOT VERIFIABLE cell, re-grade §25 severities.
- **Phase 1 – Critical corrections:** entity split with §9 guards and D1–D14; collector/receiver/verifier/authorizer capture; critical flag plus notification log; ISO report and amendment versioning; reject-with-reason plus recollection; catalog-driven units, intervals and critical limits; corrected seed; demo banner if storage is local.
- **Phase 2 – Workflow:** Collection, Reception and Worklist screens; Verification/Authorization queues; patient timeline; simulated RBAC; audit log; STAT handling and TAT timers; action dashboard.
- **Phase 3 – UX:** §28 nav; global search with URL filters; §11 tables; §12 forms; cards below 768px; WCAG 2.2 fixes; empty/loading/error states.
- **Phase 4 – Advanced:** QC; delta checks; reflex rules; delayed-result notices; CSV export; label printing; analytics; a backend API swap path so RBAC and audit are actually enforced; later HL7 interfaces and autoverification with a suspension switch.
- **Phase 5 – Polish:** design-token conformance, status colour system, §22 microcopy, one date format, motion ≤150 ms that respects `prefers-reduced-motion`.

---

## 31. FINAL ACCEPTANCE CRITERIA (Claude Code checklist)

**Discovery**
- [ ] Appendix lists every route, nav item, page, modal, table (columns verbatim), form (fields verbatim) and status enum, taken from source.
- [ ] Every NOT VERIFIABLE cell is replaced or confirmed absent.

**Workflow integrity**
- [ ] Every workflow has a start state, a terminal state and a visible next action in each intermediate state.
- [ ] Order Completed is derived only and requires all non-cancelled tests released.
- [ ] No result entry for unreceived, rejected or cancelled specimens/tests.
- [ ] No report release without authorized results; authorizer name and time are printed.
- [ ] Rejection requires a reason code and creates a linked recollection with a new accession; the order stays open.
- [ ] Amendment creates version n+1 marked "AMENDED" with a reason; the prior version stays viewable.
- [ ] D5 chronology holds; future timestamps are rejected; a seed test passes D1–D14.

**Patient safety**
- [ ] Patient identity is joined from one source and identical everywhere; identity banner on all patient-scoped screens.
- [ ] Critical results show HH/LL text, appear first on the dashboard, and a notification cannot close without the recipient's full name, role, time, lab person, method and read-back (phone).
- [ ] Abnormal flags are computed from the stored interval; every quantitative result shows a unit and interval.

**Reports**
- [ ] Every §15 element is present, including page x of y and collection/issue dates on each page; Preliminary/Final/Amended is visible.

**Roles & audit**
- [ ] A role switcher or login exists; nav and actions follow §5; performer ≠ authorizer is enforced when enabled.
- [ ] A browser-local storage banner is shown where applicable.
- [ ] The audit log records who/what/when/before→after/reason for every state change and cannot be edited.

**Search & tables**
- [ ] Global search resolves UHID, Order ID, accession and name; an exact ID opens the record directly.
- [ ] Filters combine, show as chips and persist in the URL; STAT sorts first; counts match filters.
- [ ] At 390px and 375px all tables are usable with no hidden primary action.

**Forms & states**
- [ ] Required fields are marked; inline errors say how to fix; focus goes to the first error; unsaved-changes guard works.
- [ ] Every page has empty, loading and error states; storage corruption is recoverable.
- [ ] Destructive actions need confirmation with a reason.

**Consistency, accessibility, navigation**
- [ ] One glossary constants file; no forbidden variants ("Normal range", "Approved", mixed Sample/Specimen).
- [ ] One date-time format (`DD-MMM-YYYY HH:mm`); one badge component per entity with fixed colours.
- [ ] axe-core shows no serious or critical violations; full keyboard operation; dialogs trap and restore focus.
- [ ] Deep-link refresh works on every route; every displayed ID links to its record; no dead ends.

---

## Caveats

- This edition has **zero direct observation of the app's UI or code**. Architecture claims are inferences from the repo's top-level structure and sibling apps, and the §25 severities are conditional until Phase 0.
- Competitor evidence comes from vendor pages, third-party listings and peer-reviewed implementation papers. Rankings and lab counts are vendor marketing. Several requested competitors were not researched and are deliberately not characterized.
- **Self-check:** a Claude Code session with this document and the source has a complete target specification, a verification protocol and acceptance tests, but **not yet the current-state inventory**. Phase 0 is mandatory, and its output must be appended here before implementation.

## Sources

1. [SHRI-AI | Senus Healthcare Research Institute](https://www.shri-ai.org/)
2. [GitHub - teamshriai/Laboratory](https://github.com/teamshriai/Laboratory)
3. [Convert to a static front end and deploy to /dev/procurement by vimalshriai · Pull Request #1 · teamshriai/procurement](https://github.com/teamshriai/procurement/pull/1)
4. [GitHub - teamshriai/care-entry: SHRI HEALTH Care Entry Portal](https://github.com/teamshriai/care-entry)
5. [ISO 15189:2022 Checklist](https://goaudits.com/checklist/iso-15189-2022-checklist/920/35/)
6. [SADCAS F 134 (b) Issue No: 2 Page 1 of 9 Date: 2024-03-14 VERTICAL ASSESSMENT](<https://www.sadcas.org/sites/default/files/2024-03/SADCAS_F134_(b)_-_Vertical_Assessment_ISO_15189_-_2022_for_Medical_Laboratories_%5BIssue_2%5D.pdf>)
7. [Qualimetric.co.uk ISO 15189 comparison 2012 and 2022 Summary 0123 Page 1 of 18](https://www.qualimetric.co.uk/wp-content/uploads/2023/01/Summary-of-additional-rqmts-of-ISO-15189-2022-over-ISO-15189-2012.pdf)
8. [Clinical Diagnostics LIMS](https://revollims.com/lims-software/clinical-diagnostics-lims)
9. [Critical Values CAP Requirements](https://documents-cloud.cap.org/appsuite/learning/AP3/LMD/GoodLabDecisions/04_FrmtRsltRprts/story_content/external_files/Report%20Elements%20Part%202_2019_Proof.pdf)
10. [Improving Critical Value Notification through Secure Text Messaging - ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2153353922002504)
11. [EPIC Training 2019.docx - Basics of Beaker Log into EPIC Production Hyperspace under CORE LAB. You should start at the Receiving tab with this](https://www.coursehero.com/file/65333391/EPIC-Training-2019docx/)
12. [ISO 15189:2022 Working Document Instruction Page NOTES:](https://www.pjlabs.mx/downloads/LF-56-15189-11.pdf)
13. [Beaker for Ambulatory Clinics - Physician Forum](https://physicianforum.nm.org/uploads/1/1/9/4/119404942/beaker-ambulatory-reference-guide.pdf)
14. [Implementation of Epic Beaker Clinical Pathology at an academic medical center - ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2153353922005259)
15. [Maximize Lab Potential with Pathology Lab Information System](https://creliohealth.com/lis/pathology-lab/pathology-lab-information-system)
16. [Epic Tip Sheet: Beaker Add-on Labs for Inpatient and Ambulatory Page 1 of 2](https://assets.ctfassets.net/nks45s9j0o8z/3blzHiqsG28e10xU9O4qlD/b7aa9a9fe97d2486f631738dd264029b/Ambulatory_Clinics_Tip_Sheets.pdf)
17. [CrelioHealth For Diagnostics 2026 Pricing, Features, Reviews & Alternatives](https://www.getapp.com/healthcare-pharmaceuticals-software/a/livehealth/)
18. [Orchard Software - Core LIS (Laboratory Information Systems) Software](https://intuitionlabs.ai/software/clinical-laboratory-information-systems/core-lis-laboratory-information-systems/orchard-software)
19. [ISO 15189:2022 Clause Questions Suggestions of what to look for Tier 1 Tier 2](https://cqacaribbean.com/wp-content/uploads/2024/04/LQMS-SIP-ISO15189-2022-FINAL-150424.pdf)
20. [Drlogy Pathology Lab Software - Features & Pricing (August 2025)](https://www.saasworthy.com/product/drlogy-pathology-lab-software)
21. [Clinisys™ Harvest®](https://www.clinisys.com/us/en/products/clinisys-orchard-harvest/)
22. [Implementation of Epic Beaker Clinical Pathology at Stanford University Medical Center](https://academic.oup.com/ajcp/article/147/3/261/3053466)
23. [Pathology Lab Software Brochure](https://images.drlogy.com/assets/uploads/img/drlogy-brochure/pathology-lab-software.pdf)
24. [What is the procedure for rejecting or recollecting samples that do not meet quality standards?](https://www.needle.tube/resources-articles/what-is-the-procedure-for-rejecting-or-recollecting-samples-that-do-not-meet-quality-standards)
25. [CrelioHealth LIMS: Pricing, Features, and Integration in 2026](https://www.softwaresuggest.com/live-health)
26. [Clinisys/Orchard Software - CAP TODAY](https://www.captodayonline.com/product/orchard-harvest-lis/)
27. [Orchard Software](https://intuitionlabs.ai/software/pdfs/orchard-software.pdf)
28. [India's Top-Rated Lab Information System (LIS) Software](https://creliohealth.com/in/lis/lis-system/laboratory-information-system)
29. [Medical Lab Management Software](https://creliohealth.com/us/lims/medical-lab/medical-lab-software)
30. [CrelioHealth LIMS Reviews 2026: Details, Pricing, & Features](https://www.g2.com/products/creliohealth-for-diagnostics-product/reviews)
31. [Attune Lab Information System](https://www.slideshare.net/slideshow/attune-lab-information-system/59961864)
32. [Drlogy Pathology Lab Software - Trusted by 30,000+ Labs](https://www.drlogy.com/pathology-lab-software)
