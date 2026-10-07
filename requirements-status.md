# SHRI HEALTH LIMS: research requirements status

Status of the requirements in `functionality_requirements.md` (the research pack) after the four implementation waves, as of 6 October 2026. The client in `client/` is frontend-only: it runs an in-browser demo backend (`client/src/mock/`), and every rule it enforces there is also documented for the real server in `client/README.md` ("Backend seam").

**Status labels**

- **PASS:** built and working in the portal, with the rule enforced in the demo engine and covered by tests (`client/src/mock/api/*.test.ts`).
- **PARTIAL:** the screens and data shapes exist and work in the demo, but part of the requirement can only be met by a backend, or a piece is deliberately simplified (stated in the row).
- **BLOCKED:** cannot be true without the real backend or an outside service. The UI is ready for it where possible.

Client-side permission checks are not security. Anything that depends on who the user really is, on data shared between people, or on records that cannot be altered is BLOCKED until the server exists, even where the screens and rules are complete.

## 1. Regulatory requirements (research Document 2, table 2.2)

| Requirement | Status | Where | Notes |
|---|---|---|---|
| Registration before operating; certificate; renew every 5 years | PASS | Settings > Lab profile; Quality overview | Registration number, authority and validity; a renewal reminder 90 days before expiry; registration number printed on reports and registers. |
| Tamil Nadu Form III; daily results, IQC and collection registers | PARTIAL | `/registers` | All four registers with CSV export and a signed-printout layout. The 14 Form III columns follow the research; their wording must be checked against the gazetted form (the screen says so). |
| Named signatories; pathologist-only cytology | PASS | Users & Roles (signatory registry); release | Only people on the registry for the department may authorise; microbiologists authorise microbiology only. |
| Role-based access; deactivation; audit trail of user activity | BLOCKED | Permission matrix, Audit Log | The matrix, refusals, audit entries and access logging (views, prints, exports) all work in the demo. Real authentication, server-side checks and an append-only audit store need the backend. |
| LIS verification after install, then half-yearly on 10 or more specimens | PARTIAL | `/quality?tab=lis` | Runs compare analyser, LIS and report values for at least 10 specimens, are reviewed by someone else and fall due after 6 months. The analyser values are simulated until analysers are connected. |
| Interface verification; no misfiling | PARTIAL | `/interfaces` | Interface monitor, versioned test-code mapping and an error queue with retry. All traffic is simulated (no HL7/ASTM connection). |
| Critical limits communicated "after proper documentation" | PASS | `/critical-results`, result entry | Blocking dialog at entry, read-back required, every attempt kept, escalation tiers on timers, release held until communicated (configurable). |
| Auto-verification: approved rules, label, annual review, rapid suspension | PASS | `/quality?tab=autoverify`, Settings > Assistant, `/verification` | Versioned rules authorised by a different signatory; always include the critical check; annual review flag; a kill switch, off by default. Rules only mark results; a person still authorises. |
| After-hours preliminary report, finalised later | PASS | Reports | Preliminary, final and amended versions; earlier versions are never overwritten. |
| Referral only to NABL-accredited labs; referral lab named on report | PASS | Specimen detail (send-out), reports | Referral-lab master with the NABL flag; send-out tracking; "Performed by" on the report. |
| Non-accredited tests disclosed | PASS | Test catalogue, reports | Accredited-scope flag per test; footnote on the report. |
| Collection-time log; transport risk; consent for HIV/invasive tests | PASS | Collection | Collection time and collector required; identity check with two identifiers; fasting status; consent blocks collection; receipt temperature and transit alerts. |
| Rejection criteria and communicated reasons | PASS | Reception, collection | Reason codes including haemolysed, lipaemic, clotted, insufficient volume, wrong container, unlabelled; linked recollection. |
| IQC: two levels, Levey-Jennings, Westgard, monthly statistics | PASS | `/quality-control` | Existing before this work; QC failure holds authorisation on the analyser. |
| EQA/PT; measurement uncertainty from 6 months of IQC | PASS | `/quality?tab=eqa`, `?tab=uncertainty` | z-scores, an unacceptable result raises a non-conformance; CV and expanded uncertainty (k = 2) from at least 20 IQC results, with EQA bias shown separately. Adding a new EQA round needs a backend call that does not exist yet (rounds come from the provider). |
| Equipment IQ/OQ/PQ, calibration; reagent lots | PASS | Equipment drawer, `/cold-storage` | Qualification records, calibration history, lots traced to results; temperature logs with excursion actions. |
| Retention minimums (NABL 112A Table 2) and legal hold | PARTIAL | `/privacy?tab=retention`, `?tab=holds` | Retention per record class and legal holds are recorded; erasure is refused under a hold. Actual deletion and keeping records for those periods happen in the server's storage. |
| Quality indicators; annual audit and risk review | PASS | `/quality` | Six indicators against targets with trends; internal audits (auditor independence; nonconformities raise an NC); risk register with residual scoring and review dates; CAPA with an independent effectiveness check; controlled documents with independent sign-off. |
| DPDP notice, consent, rights, grievance | PARTIAL | Patient Consents tab, `/privacy` | Consent records per purpose, rights requests with due dates, grievance officer details, messaging opt-outs. Notices in the patient's language and identity verification of the requester need the backend and the patient channel. |
| Security safeguards; 1-year logs | BLOCKED | | Encryption, backups and log retention are server and infrastructure work. The demo records the log entries the server must keep. |
| Breach intimation (Board within 72 hours) | PASS | `/privacy?tab=incidents` | Incident register with CERT-In 6-hour and Board 72-hour deadlines; closes only when contained and reported. Filing the reports themselves is done outside the system. |
| CERT-In 6-hour reporting; 180-day logs in India | BLOCKED | | The deadline is tracked in the incident register; India-region log storage is infrastructure. |
| SNOMED CT / LOINC + UCUM | PARTIAL | `/interfaces?tab=coding` | LOINC codes seeded for common analytes and UCUM units derived, with a coverage view. Every code must be confirmed in the lab's own LOINC review; SNOMED CT is not included. |
| ABDM HIP / FHIR | BLOCKED | | Optional ABHA number and address on patients; LOINC/UCUM ready. FHIR bundles and the NHA gateway need the backend. |
| Aadhaar never mandatory | PASS | Patient registration | No Aadhaar field; the privacy note says it is never required. |
| AI as a medical device (CDSCO) | Not applicable now | | Nothing in the product is AI: the assistant and the suggestions are rule-based and labelled so. A regulatory opinion is still needed before any model is added. |

## 2. Gap analysis (research Document 4, table 4.2)

| Area | Status | Notes |
|---|---|---|
| Information architecture (role-based queues, module navigation) | PASS | Work queue with saved views and shortcuts; role-based navigation (a referring doctor sees only "My practice"; business items only for roles that use them); modules can be switched off. |
| Domain model (order, test, specimen, aliquot, result, report version) | PASS | Separate entities; split, add-on, deferred collection and recollection supported. |
| Work queue triage | PASS | Prioritised, TAT-aware, keyboard shortcuts, scan field. |
| Barcode print and scan | PASS | Label printing with a print log; scan-to-open in the work queue and command palette. |
| Two-step release with signatory rules | PASS | Technical review then authorisation; independent review setting. |
| Critical results | PASS | See section 1. |
| Immutable report versions | PARTIAL | Versions are never overwritten and each is sealed with a SHA-256 digest and a verification page; true immutability needs the server's storage. |
| Audit and RBAC | BLOCKED | See section 1. |
| Rejection and recollection | PASS | |
| TAT and analytics from events | PASS | Derived from recorded events; revenue shown only to roles that may see it. |
| QC, equipment, inventory | PASS | |
| Analyser interface UI | PARTIAL | Simulated. |
| Billing and GST | PARTIAL | Invoices, packages, account prices, discounts with authorisation, payments, refunds, cash close, GST fields. No payment is processed (no gateway); GST rates must be confirmed by a tax adviser. Credit-account settlement is not built. |
| Collection centres, home collection, portals | PARTIAL | Centre master (NABL 111 fields), home collection with routes and proof of collection, doctor portal, patient report links with date-of-birth check and QR verification. OTP login and real delivery need the backend. |
| Interoperability (API, HL7/ASTM, FHIR/ABDM) | PARTIAL | The full REST contract exists (`client/src/services/http/endpoints.ts`, `client/docs/api-contract.md`) with a ready HTTP client; HL7/ASTM and FHIR are not implemented. |
| Accessibility and languages | PASS | English, Hindi, Kannada, Tamil and Malayalam on every screen; WCAG 2.2 AA checked with axe in the browser audits; 44px targets; 320px to 2560px layouts. |
| AI | PASS (as governed, rule-based) | Suggestions follow the research's card contract (statement, confidence, why, data window, sources, rule version, feedback, "verify before acting"); feedback and assistant use are audited; both can be switched off. No machine learning. |

## 3. User complaints turned into requirements (research Document 1, table 1.6)

| Requirement | Status | Notes |
|---|---|---|
| Fewer steps; keyboard-first | PASS | Command palette, shortcuts, one-screen new order with labels; billing from the order drawer. |
| Specimen edge cases | PASS | Aliquots, add-ons, deferred collection, recollection, send-outs. |
| Errors show a code and help path | PARTIAL | Every refusal has a code and a translated message naming who may act; in-app ticketing is not built. |
| Flexible reporting; audited bulk export | PASS | CSV exports on every list, audited; registers. A query builder is not built. |
| Speed (server pagination, budgets) | PARTIAL | Server-side paging on long lists; the performance test keeps reads under 400 ms at 10x the demo data. The research's p95 under 200 ms on a 10k-row queue must be measured on the real backend. |
| Versioned configuration | PARTIAL | Controlled documents, auto-verification rules and code mappings are versioned; settings changes are audited field by field but not versioned. |
| Trackability | PASS | Specimen timeline and history; patient timeline. |
| No fake AI or badges | PASS | Nothing claims AI; every simulated or not-connected function says so on screen. |

## 4. What only the real backend can make true

1. **Authentication and sessions:** real login with MFA for signatories and administrators, session expiry, deactivation. The demo's "acting as" is a role switcher.
2. **Server-side permissions:** every check in `domain/permissions.ts` and every rule in `mock/engine/` must run on the server for every request, including reads (the demo scopes only the doctor portal's reads).
3. **A tamper-evident, append-only audit trail and access log**, kept for the longer of one year (DPDP Rules 2025, Rule 6) and 180 days in India (CERT-In).
4. **Shared, durable data:** today each browser has its own copy. Multi-user work, report links that open on other devices, and retention or deletion schedules need the server's database.
5. **Messaging:** SMS through DLT-registered templates, the WhatsApp Business API and email. Every outbox entry is "not sent" until then.
6. **Payments:** a payment gateway and reconciliation; the demo only records payments.
7. **Analyser connections:** HL7/ASTM interfaces (the Interfaces screen simulates them).
8. **ABDM and FHIR:** the HIP/HIU integration through the NHA gateway and FHIR bundles.
9. **Server-generated, signed PDFs** for reports (Download PDF prints from the browser today).
10. **Security operations:** encryption at rest and in transit, backups, India-region logs, incident runbooks and CERT-In reporting.
