/**
 * The laboratory's controlled vocabulary for English UI copy (audit §6).
 * `i18n/terminology.test.ts` fails when copy drifts back to the terms on the
 * left of each rule. Internal code names (`Sample`, `validateItems`) are not
 * affected; only what people read is.
 */
export const GLOSSARY = [
  {
    term: 'Specimen',
    meaning: 'The physical material collected from the patient.',
    instead: /\bsamples?\b/i,
  },
  {
    term: 'Accession No.',
    meaning: 'The laboratory number that identifies one specimen.',
    instead: /\bsample id\b/i,
  },
  {
    term: 'Verify / Verified',
    meaning: 'Technical verification by a second person in the lab.',
    instead: /\bvalidat/i,
  },
  {
    term: 'Authorise / Authorised',
    meaning: 'Medical authorisation by a pathologist or microbiologist.',
    instead: /\bapprov/i,
  },
  {
    term: 'Reference interval',
    meaning: 'The interval a result is compared with.',
    instead: /\b(reference|normal) range/i,
  },
  {
    term: 'UHID',
    meaning: "The hospital's unique patient identifier.",
    instead: /\b(patient id|mrn)\b/i,
  },
  {
    term: 'Awaiting <stage>',
    meaning: 'Name the stage something waits for, never a bare "Pending".',
    instead: /^pending$/i,
  },
] as const
