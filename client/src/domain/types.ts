// Domain model for the laboratory. Entities reference each other by id only.
// All instants are epoch milliseconds and their field names end in `At`
// (the store relies on this convention when it moves demo data forward).

export const LANGUAGES = ['en', 'hi', 'kn', 'ta', 'ml'] as const
export type Language = (typeof LANGUAGES)[number]

export const SEXES = ['M', 'F', 'O'] as const
export type Sex = (typeof SEXES)[number]

export const BLOOD_GROUPS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const
export type BloodGroup = (typeof BLOOD_GROUPS)[number]

export const ENCOUNTER_TYPES = [
  'OPD',
  'IPD',
  'EMERGENCY',
  'ICU',
  'DAYCARE',
] as const
export type EncounterType = (typeof ENCOUNTER_TYPES)[number]

export const PRIORITIES = ['routine', 'urgent', 'stat'] as const
export type Priority = (typeof PRIORITIES)[number]

export const DEPARTMENTS = [
  'hematology',
  'biochemistry',
  'clinical-pathology',
  'microbiology',
  'immunology',
  'serology',
  'histopathology',
  'cytology',
] as const
export type DepartmentId = (typeof DEPARTMENTS)[number]

export const CLINICAL_DEPARTMENTS = [
  'general-medicine',
  'cardiology',
  'endocrinology',
  'nephrology',
  'obstetrics',
  'paediatrics',
  'general-surgery',
  'orthopaedics',
  'emergency',
  'critical-care',
  'oncology',
  'pulmonology',
  'gastroenterology',
  'dermatology',
] as const
export type ClinicalDepartmentId = (typeof CLINICAL_DEPARTMENTS)[number]

export const CONTAINERS = [
  'edta',
  'sst',
  'plain',
  'citrate',
  'fluoride',
  'heparin',
  'urine',
  'stool',
  'culture-bottle',
  'sterile',
  'formalin',
  'slide',
] as const
export type ContainerId = (typeof CONTAINERS)[number]

export const SPECIMENS = [
  'whole-blood',
  'serum',
  'citrated-plasma',
  'fluoride-plasma',
  'heparin-plasma',
  'urine',
  'stool',
  'blood',
  'sputum',
  'swab',
  'body-fluid',
  'tissue',
  'aspirate',
  'cervical-smear',
] as const
export type SpecimenId = (typeof SPECIMENS)[number]

export const SPECIAL_INSTRUCTIONS = [
  'fasting-8-10h',
  'fasting-10-12h',
  'two-hours-after-meal',
  'first-morning-urine',
  'midstream-clean-catch',
  'before-antibiotics',
  'two-sets-two-sites',
  'fill-to-line',
  'transport-on-ice',
  'deliver-within-1h',
  'fix-in-formalin',
  'fix-in-alcohol',
  'early-morning-sputum',
  'air-dry-slides',
  'sterile-container',
] as const
export type SpecialInstruction = (typeof SPECIAL_INSTRUCTIONS)[number]

export const RESULT_TYPES = [
  'numeric',
  'select',
  'posneg',
  'text',
  'narrative',
  'antibiogram',
] as const
export type ResultType = (typeof RESULT_TYPES)[number]

export const FLAGS = [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL_LOW',
  'CRITICAL_HIGH',
  'POSITIVE',
  'NEGATIVE',
  'ABNORMAL',
] as const
export type Flag = (typeof FLAGS)[number]

export const STAFF_ROLES = [
  'phlebotomist',
  'technician',
  'pathologist',
  'microbiologist',
  'lab-manager',
  'receptionist',
  /** Runs the business: billing, revenue, settings. */
  'owner',
  /** A referring doctor: sees only their own patients' reports. */
  'doctor',
] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

// ---------- Reference data ----------

export interface Doctor {
  id: string
  name: string
  department: ClinicalDepartmentId
  qualification: string
  phone: string
  specialty?: string
  /** Medical council registration number. */
  registrationNo?: string
  email?: string
  /** An outside referrer (clinic or hospital), not on the hospital staff. */
  external?: boolean
  clinic?: string
  /** Missing means active. */
  active?: boolean
}

/**
 * A person authorised to sign (authorise) reports, per discipline: the
 * signatory registry NABL 112A and the Tamil Nadu rules ask labs to keep
 * (names, registration and the departments each may sign for).
 */
export interface SignatoryRegistration {
  /** Medical council registration number. */
  registrationNo: string
  /** The registering council, e.g. "Tamil Nadu Medical Council". */
  council: string
  departments: DepartmentId[]
  /** Epoch ms; the registration lapses after this. */
  validUntil?: number
  active: boolean
}

export interface Staff {
  id: string
  name: string
  role: StaffRole
  department?: DepartmentId
  qualification?: string
  signatory?: SignatoryRegistration
  /** For the doctor role: the doctor record whose patients they see. */
  doctorId?: string
}

export interface ReferenceRange {
  id: string
  analyteId: string
  sex: 'any' | 'M' | 'F'
  /** Inclusive lower bound, in years. */
  ageMin: number
  /** Exclusive upper bound, in years. */
  ageMax: number
  specimen?: SpecimenId
  low: number | null
  high: number | null
}

export interface Analyte {
  id: string
  name: string
  unit: string
  resultType: ResultType
  decimals?: number
  /** Allowed values for select results (stored and printed as written). */
  options?: string[]
  /** Select values that count as normal; anything else is ABNORMAL. */
  normalOptions?: string[]
  /** For posneg results: wording used for the two outcomes. */
  posnegStyle?: 'positive' | 'reactive' | 'detected'
  criticalLow?: number
  criticalHigh?: number
  /** A positive / abnormal result is a critical value (e.g. blood culture). */
  criticalIfAbnormal?: boolean
  /** Delta-check threshold: percentage change versus the previous result. */
  deltaPct?: number
  /**
   * Physiologically possible limits. A value outside them is refused at
   * entry as a likely typing or unit error (absurd-value check).
   */
  plausibleLow?: number
  plausibleHigh?: number
  /** Antibiotic panel for antibiogram results. */
  antibiotics?: string[]
  /** Only shown when this analyte (in the same test) has an abnormal value. */
  dependsOn?: string
  /** Quick-insert phrases for narrative results. */
  templates?: string[]
  /** LOINC code (MoHFW EHR Standards; ABDM FHIR bundles). */
  loinc?: string
  /**
   * Derived from other analytes of the same test (domain/calculated.ts);
   * the system computes it, nobody types it.
   */
  calculated?: boolean
}

export interface LabTest {
  id: string
  code: string
  name: string
  shortName: string
  department: DepartmentId
  specimen: SpecimenId
  container: ContainerId
  volumeMl: number | null
  fasting: boolean
  instructions: SpecialInstruction[]
  /** Target turnaround in hours for routine priority. */
  tatHours: number
  /** Target turnaround in hours for STAT priority. */
  statTatHours: number
  price: number
  active: boolean
  analyteIds: string[]
  method?: string
  /** LOINC code (optional external terminology), e.g. 718-7. */
  loinc?: string
  /** Increases with every change to the definition (audited with a reason). */
  version?: number
  keywords?: string[]
  category?: string
  description?: string
  /** Specimen stability after collection, in hours. */
  stabilityHours?: number
  storage?: StorageCondition
  minVolumeMl?: number
  /** Price billed to insurance / TPA patients. */
  priceInsurance?: number
  /** Collection needs the patient's recorded consent (HIV, invasive). */
  consentRequired?: boolean
  /**
   * Within the lab's NABL scope of accreditation. Tests outside it are
   * marked on the report (NABL 112A 6(f)). Missing means accredited.
   */
  accredited?: boolean
  /** Referral lab this test is normally sent to (it is not done in-house). */
  sendOutLabId?: string
  /** Report comments the lab uses for this test, inserted at entry. */
  commentTemplates?: string[]
}

/**
 * An outside laboratory specimens are referred to. NABL 112A expects
 * referrals to accredited labs and the referral lab named on the report.
 */
export interface ReferralLab {
  id: string
  name: string
  city: string
  nablAccredited: boolean
  /** NABL certificate number, when accredited. */
  certificateNo?: string
  contact: string
  /** Usual days from dispatch to result. */
  turnaroundDays: number
  active: boolean
}

// ---------- Patients ----------

export interface LocalName {
  lang: Exclude<Language, 'en'>
  text: string
}

export interface ClinicalNote {
  id: string
  at: number
  by: string
  text: string
}

export interface Encounter {
  type: EncounterType
  department: ClinicalDepartmentId
  ward?: string
  bed?: string
  /** Inpatient admission number (IPD / ICU). */
  ipNumber?: string
  /** Visit number of the current encounter (OP, ER or day-care). */
  visitNo?: string
  /** Consultant responsible for the encounter. */
  attendingDoctorId?: string
}

export interface Patient {
  id: string
  uhid: string
  name: string
  nameLocal?: LocalName
  sex: Sex
  /** ISO calendar date (YYYY-MM-DD). */
  dob: string
  mobile: string
  email?: string
  bloodGroup?: BloodGroup
  allergies: string[]
  city: string
  state: string
  encounter: Encounter
  notes: ClinicalNote[]
  registeredAt: number
  preferredLanguage?: Language
  /** Changes to registration details. */
  history?: HistoryEntry[]
  /** Indian postal PIN code (6 digits). */
  pinCode?: string
  /**
   * Ayushman Bharat Health Account: optional, never required. Aadhaar is
   * not collected at all.
   */
  abha?: { number?: string; address?: string }
  /** Merged into this patient (a duplicate registration); read-only now. */
  mergedInto?: string
  mergedAt?: number
  /** Channels the patient asked not to be messaged on. */
  messagingOptOut?: Partial<Record<MessageChannel, boolean>>
}

// ---------- Consent ----------

/** What a consent covers. */
export const CONSENT_PURPOSES = [
  'test-procedure',
  'data-processing',
  'report-sharing',
  'research',
] as const
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]

export const CONSENT_METHODS = [
  'written',
  'verbal-witnessed',
  'electronic',
] as const
export type ConsentMethod = (typeof CONSENT_METHODS)[number]

export interface ConsentRecord {
  id: string
  patientId: string
  purpose: ConsentPurpose
  status: 'granted' | 'refused' | 'withdrawn'
  method: ConsentMethod
  /** Language the patient was informed in. */
  language: Language
  /** When the patient gave (or refused) it. */
  at: number
  recordedBy: string
  recordedAt: number
  /** Witness's full name (verbal consent). */
  witness?: string
  /** For a test procedure: the tests it covers. */
  orderItemIds?: string[]
  notes?: string
  withdrawnAt?: number
  withdrawnBy?: string
  withdrawReason?: string
}

// ---------- Orders ----------

export const ORDER_STATES = ['draft', 'active', 'cancelled'] as const
export type OrderState = (typeof ORDER_STATES)[number]

/**
 * Derived order status (the stored state is draft / active / cancelled).
 * new = ordered, awaiting collection; awaiting-review = results entered,
 * awaiting technical review; awaiting-validation = reviewed, awaiting
 * pathologist authorisation; rejected = every sample rejected and none
 * re-collected.
 */
export const ORDER_STATUSES = [
  'draft',
  'new',
  'partially-collected',
  'collected',
  'processing',
  'pending-result',
  'awaiting-review',
  'awaiting-validation',
  'awaiting-release',
  'partially-reported',
  'completed',
  'cancelled',
  'rejected',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const CANCEL_REASONS = [
  'duplicate-order',
  'doctor-request',
  'patient-refused',
  'patient-discharged',
  'wrong-test',
  'billing-issue',
  'other',
] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]

export interface HistoryEntry {
  id: string
  at: number
  by: string
  type: string
  params?: Record<string, string | number>
}

export interface LabOrder {
  id: string
  orderNo: string | null
  patientId: string
  doctorId: string
  department: ClinicalDepartmentId
  encounter: EncounterType
  ward?: string
  bed?: string
  priority: Priority
  clinicalNotes: string
  /** The site that registered the order; missing means the main lab. */
  siteId?: string
  state: OrderState
  cancelReason?: CancelReason
  cancelRemarks?: string
  cancelledAt?: number
  cancelledBy?: string
  createdAt: number
  createdBy: string
  orderedAt: number | null
  /** Tests chosen while the order is still a draft (no items exist yet). */
  draftTestIds?: string[]
  history: HistoryEntry[]
}

/**
 * entered = submitted by the analyst; reviewed = technical validation done
 * (a second pair of eyes in the lab); validated = clinical authorisation by
 * a pathologist or microbiologist.
 */
export const RESULT_STATUSES = [
  'pending',
  'draft',
  'entered',
  'reviewed',
  'validated',
  'returned',
  'held',
  'void',
] as const
export type ResultStatus = (typeof RESULT_STATUSES)[number]

export interface ItemComment {
  id: string
  at: number
  by: string
  text: string
  visibility: 'internal' | 'report'
}

export interface OrderItem {
  id: string
  orderId: string
  testId: string
  // Snapshot of the catalog at ordering time.
  testCode: string
  testName: string
  department: DepartmentId
  specimen: SpecimenId
  container: ContainerId
  price: number
  tatHours: number
  analyteIds: string[]
  // Lifecycle.
  active: boolean
  cancelledAt?: number
  cancelledBy?: string
  cancelReason?: CancelReason
  sampleId: string | null
  status: ResultStatus
  enteredAt?: number
  enteredBy?: string
  /** Technical validation. */
  reviewedAt?: number
  reviewedBy?: string
  /** Clinical authorisation. */
  validatedAt?: number
  validatedBy?: string
  returnedReason?: string
  heldReason?: string
  /** Times this test was rerun on the same specimen. */
  rerunCount?: number
  comments: ItemComment[]
  reportId: string
  /** Within the NABL scope when ordered (snapshot of the catalog). */
  accredited?: boolean
  /** Performed by a referral lab (the report names it). */
  performedBy?: {
    labId: string
    name: string
    city?: string
    nablAccredited: boolean
    certificateNo?: string
  }
}

// ---------- Samples ----------

export const SAMPLE_STATUSES = [
  'pending_collection',
  'collected',
  'received',
  'processing',
  'on_hold',
  'completed',
  'rejected',
  'discarded',
] as const
export type SampleStatus = (typeof SAMPLE_STATUSES)[number]

export const REJECTION_REASONS = [
  'insufficient-sample',
  'hemolyzed-sample',
  'lipaemic-sample',
  'clotted-sample',
  'unlabelled-sample',
  'wrong-container',
  'incorrect-label',
  'leaking-container',
  'improper-storage',
  'delayed-transport',
  'other',
] as const
export type RejectionReason = (typeof REJECTION_REASONS)[number]

export const COLLECTION_FAILURE_REASONS = [
  'patient-not-fasting',
  'patient-unavailable',
  'patient-refused',
  'difficult-venipuncture',
  'wrong-patient-details',
  'other',
] as const
export type CollectionFailureReason =
  (typeof COLLECTION_FAILURE_REASONS)[number]

export const HOLD_REASONS = [
  'analyzer-down',
  'repeat-testing',
  'qc-failure',
  'awaiting-clinical-info',
  'reagent-unavailable',
  'other',
] as const
export type HoldReason = (typeof HOLD_REASONS)[number]

/** How the collector confirmed the patient's identity (two identifiers). */
export const IDENTITY_METHODS = [
  'name-dob',
  'name-uhid',
  'name-mobile',
  'wristband',
] as const
export type IdentityMethod = (typeof IDENTITY_METHODS)[number]

export const FASTING_STATUSES = ['fasting', 'non-fasting', 'unknown'] as const
export type FastingStatus = (typeof FASTING_STATUSES)[number]

/** Temperature of the specimen on arrival. */
export const RECEIPT_TEMPERATURES = [
  'ambient',
  'chilled',
  'frozen',
  'out-of-range',
] as const
export type ReceiptTemperature = (typeof RECEIPT_TEMPERATURES)[number]

export const SEND_OUT_STATES = ['dispatched', 'received', 'resulted'] as const
export type SendOutState = (typeof SEND_OUT_STATES)[number]

export interface SendOut {
  labId: string
  state: SendOutState
  dispatchedAt: number
  dispatchedBy: string
  courier?: string
  /** The referral lab's own reference. */
  externalRef?: string
  receivedAt?: number
  resultedAt?: number
}

export const COLLECTION_SITES = [
  'left-antecubital',
  'right-antecubital',
  'dorsal-hand',
  'finger-prick',
  'heel-prick',
  'central-line',
  'arterial-line',
  'midstream-urine',
  'catheter-urine',
  'throat',
  'wound',
  'other',
] as const
export type CollectionSite = (typeof COLLECTION_SITES)[number]

export interface SampleRejection {
  stage: 'collection' | 'lab'
  reason: RejectionReason | CollectionFailureReason
  remarks?: string
  at: number
  by: string
  recollectionRequested: boolean
}

export interface Sample {
  id: string
  accessionNo: string | null
  orderId: string
  patientId: string
  department: DepartmentId
  container: ContainerId
  specimen: SpecimenId
  volumeMl: number | null
  status: SampleStatus
  createdAt: number
  labelPrintedAt?: number
  labelPrintCount: number
  collectedAt?: number
  collectedBy?: string
  collectionSite?: CollectionSite
  collectionRemarks?: string
  receivedAt?: number
  receivedBy?: string
  /** Condition confirmed at receipt (an unacceptable one is rejected). */
  receiptCondition?: 'acceptable'
  receiptNote?: string
  processingStartedAt?: number
  processingBy?: string
  equipmentId?: string
  heldAt?: number
  heldBy?: string
  holdReason?: HoldReason
  holdRemarks?: string
  holdFrom?: 'received' | 'processing'
  completedAt?: number
  rejection?: SampleRejection
  recollectionOfId?: string
  recollectedById?: string
  history: HistoryEntry[]
  /** Technician responsible for the bench work. */
  assignedTo?: string
  /** How the patient was identified at collection. */
  identityCheck?: { method: IdentityMethod; at: number; by: string }
  fastingStatus?: FastingStatus
  /** Collection deliberately deferred to this time (e.g. post-prandial). */
  scheduledFor?: number
  scheduleReason?: string
  receiptTemperature?: ReceiptTemperature
  /** Arrived outside the temperature its tests need. */
  temperatureDeviation?: boolean
  /** An aliquot: split from this specimen. */
  parentId?: string
  aliquotNo?: number
  /** Referred to an outside laboratory. */
  sendOut?: SendOut
}

// ---------- Results ----------

export interface RangeSnapshot {
  low: number | null
  high: number | null
  criticalLow?: number
  criticalHigh?: number
}

export interface ResultRevision {
  value: string
  flag: Flag | null
  at: number
  by: string
  /** Report version this value was released in, when it was released. */
  reportVersion?: number
  reason?: string
  comments?: string
  /** The value was replaced by a rerun (both stay on record). */
  rerun?: boolean
  dilution?: number
}

export interface Result {
  id: string
  orderItemId: string
  analyteId: string
  value: string | null
  flag: Flag | null
  unit: string
  range: RangeSnapshot | null
  remarks?: string
  updatedAt: number
  updatedBy: string
  /** Where the value came from: an analyzer id, or 'manual' entry. */
  source?: string
  /** Dilution factor applied before the measurement (a rerun). */
  dilution?: number
  /** Earlier values, oldest first. Never overwritten silently. */
  revisions: ResultRevision[]
  /** Flags the analyzer sent with the value. */
  instrumentFlags?: InstrumentFlag[]
  /** Computed by the system from other results (domain/calculated.ts). */
  calculated?: boolean
  /**
   * The auto-verification rule's checks at entry (when switched on). A
   * person still authorises; passing results can be authorised together.
   */
  autoCheck?: {
    ruleId: string
    version: number
    passed: boolean
    failed: AutoVerifyCheck[]
  }
}

export const INSTRUMENT_FLAGS = [
  'hemolysis-index',
  'lipemia-index',
  'icterus-index',
  'clot-detected',
  'short-sample',
  'above-linearity',
  'below-detection',
] as const
export type InstrumentFlag = (typeof INSTRUMENT_FLAGS)[number]

// ---------- Critical values ----------

export const CRITICAL_STATUSES = [
  'open',
  'notified',
  'acknowledged',
  'voided',
] as const
export type CriticalStatus = (typeof CRITICAL_STATUSES)[number]

/** A critical value must be communicated within this many minutes of detection. */
export const CRITICAL_NOTIFY_LIMIT_MIN = 30

export const NOTIFY_METHODS = [
  'phone',
  'in-person',
  'his-message',
  'sms',
  'whatsapp',
] as const
export type NotifyMethod = (typeof NOTIFY_METHODS)[number]

export const NOTIFY_ROLES = [
  'consultant',
  'resident',
  'staff-nurse',
  'duty-doctor',
] as const
export type NotifyRole = (typeof NOTIFY_ROLES)[number]

export interface CriticalAlert {
  id: string
  resultId: string
  orderItemId: string
  orderId: string
  sampleId: string
  patientId: string
  analyteId: string
  value: string
  flag: Flag
  status: CriticalStatus
  detectedAt: number
  detectedBy: string
  notifiedAt?: number
  notifiedBy?: string
  notifiedTo?: string
  notifiedRole?: NotifyRole
  method?: NotifyMethod
  notifyRemarks?: string
  acknowledgedAt?: number
  acknowledgedBy?: string
  readBack?: boolean
  ackRemarks?: string
  voidedAt?: number
  voidReason?: string
  /** Every call or message made about this value, oldest first. */
  attempts: NotifyAttempt[]
  escalatedAt?: number
  escalatedBy?: string
  escalatedTo?: string
  escalationReason?: string
  history: HistoryEntry[]
}

export const NOTIFY_OUTCOMES = [
  'reached',
  'no-answer',
  'busy',
  'wrong-number',
  'left-message',
] as const
export type NotifyOutcome = (typeof NOTIFY_OUTCOMES)[number]

/** One attempt to communicate a critical value. */
export interface NotifyAttempt {
  id: string
  at: number
  by: string
  to: string
  role: NotifyRole
  method: NotifyMethod
  outcome: NotifyOutcome
  remarks?: string
}

/**
 * What a critical value looks like to the lab: contacting = attempts made but
 * nobody reached yet; escalated = raised to a senior clinician because the
 * notification window was missed or the clinician could not be reached.
 */
export const CRITICAL_STATES = [
  'open',
  'contacting',
  'notified',
  'escalated',
  'acknowledged',
  'voided',
] as const
export type CriticalState = (typeof CRITICAL_STATES)[number]

// ---------- Reports ----------

export const REPORT_STATUSES = [
  'draft',
  'pending-validation',
  'validated',
  'preliminary',
  'released',
  'amendment-pending',
  'corrected',
  'withdrawn',
] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const CORRECTION_REASONS = [
  'transcription-error',
  'repeat-analysis',
  'sample-mix-up',
  'calculation-error',
  'wrong-unit',
  'clinical-correlation',
  'other',
] as const
export type CorrectionReason = (typeof CORRECTION_REASONS)[number]

export const SHARE_CHANNELS = ['sms', 'whatsapp', 'email', 'doctor'] as const
export type ShareChannel = (typeof SHARE_CHANNELS)[number]

/** One released value as it appeared in a report version. */
export interface ReportedValue {
  resultId: string
  analyteName: string
  value: string
  unit: string
  flag: Flag | null
}

export interface ReportVersion {
  version: number
  /**
   * preliminary: some tests released before all are authorised;
   * final: every test authorised; amended: a correction to a released one.
   */
  kind?: 'preliminary' | 'final' | 'amended'
  /** The tests released in this version. */
  itemIds?: string[]
  releasedAt: number
  releasedBy: string
  correctionReason?: CorrectionReason
  correctionComments?: string
  correctedResultIds?: string[]
  /** Who asked for the correction (the releaser authorised it). */
  requestedBy?: string
  requestedAt?: number
  /** The values as released in this version. */
  snapshot?: ReportedValue[]
  /** SHA-256 of the version's content, printed and checked on /v/<token>. */
  digest?: string
  /** Opaque token of this version's verification page (QR code). */
  verifyToken?: string
}

/** A correction to a released report, waiting for pathologist authorisation. */
export interface PendingAmendment {
  requestedAt: number
  requestedBy: string
  reason: CorrectionReason
  comments: string
  changes: {
    resultId: string
    analyteName: string
    from: string
    fromFlag: Flag | null
    to: string
    toFlag: Flag | null
    unit: string
  }[]
}

export interface ShareRecord {
  id: string
  at: number
  by: string
  channel: ShareChannel
  recipient: string
  version: number
}

export interface Report {
  id: string
  reportNo: string
  orderId: string
  patientId: string
  department: DepartmentId
  createdAt: number
  versions: ReportVersion[]
  shareLog: ShareRecord[]
  printCount: number
  lastPrintedAt?: number
  interpretation?: string
  /** A corrected version exists that earlier recipients have not received. */
  renotifyPending?: boolean
  /** A requested correction awaiting authorisation. */
  pendingAmendment?: PendingAmendment
  /** Withdrawn after release (for example issued for the wrong patient). */
  withdrawn?: { at: number; by: string; reason: string }
}

export const SHARE_LINK_OUTCOMES = [
  'opened',
  'dob-mismatch',
  'expired',
  'revoked',
  'locked',
] as const
export type ShareLinkOutcome = (typeof SHARE_LINK_OUTCOMES)[number]

export const SHARE_REVOKE_REASONS = ['manual', 'amended', 'withdrawn'] as const
export type ShareRevokeReason = (typeof SHARE_REVOKE_REASONS)[number]

/**
 * A link to a released report for the patient or their doctor. The URL
 * carries an opaque random token (128 bits); only its SHA-256 is stored, so
 * nobody can rebuild a link from the database. It expires, can be revoked,
 * asks for the patient's date of birth and keeps an access log. An
 * amendment or withdrawal revokes it.
 */
export interface ShareLink {
  id: string
  tokenHash: string
  kind: 'laboratory' | 'imaging'
  /** Report id (laboratory) or imaging study id. */
  targetId: string
  reportNo: string
  /** The version that was current when the link was made. */
  version: number
  createdAt: number
  createdBy: string
  expiresAt: number
  revokedAt?: number
  revokedBy?: string
  revokeReason?: ShareRevokeReason
  /** Wrong dates of birth in a row; the link locks after five. */
  failedAttempts: number
  lockedUntil?: number
  access: { at: number; outcome: ShareLinkOutcome }[]
}

/** The public verification page of one issued report version (QR code). */
export interface ReportVerification {
  token: string
  kind: 'laboratory' | 'imaging'
  targetId: string
  reportNo: string
  version: number
  digest: string
  issuedAt: number
}

// ---------- Diagnostic imaging ----------

export const MODALITIES = ['ct', 'mri', 'xray'] as const
export type Modality = (typeof MODALITIES)[number]

/** Derived from the study (see `imagingStatus` in domain/imaging.ts). */
export const IMAGING_STATUSES = [
  'scheduled',
  'acquired',
  'reported',
  'final',
  'amended',
] as const
export type ImagingStatus = (typeof IMAGING_STATUSES)[number]

export interface Signatory {
  name: string
  qualification: string
}

export interface ImagingFinding {
  heading: string
  text: string
}

/** One issued version of an imaging report; earlier versions are kept. */
export interface ImagingReportVersion {
  version: number
  kind: 'preliminary' | 'final' | 'amended'
  releasedAt: number
  reportedBy: Signatory
  verifiedBy: Signatory
  technique: string
  comparison?: string
  findings: ImagingFinding[]
  impression: string[]
  recommendations?: string[]
  /** Why this version replaced the previous one. */
  amendmentReason?: string
  /** SHA-256 of the version's content and its verification page token. */
  digest?: string
  verifyToken?: string
}

/**
 * A diagnostic imaging study and its report. Read-only in the frontend
 * phase: acquisition and reporting happen in the RIS/PACS (future).
 */
export interface ImagingStudy {
  id: string
  accessionNo: string
  /** Set once a report is issued. */
  reportNo?: string
  patientId: string
  orderingDoctorId: string
  modality: Modality
  examName: string
  bodyRegion: string
  indication: string
  contrast?: string
  priority: Priority
  scheduledAt: number
  performedAt?: number
  versions: ImagingReportVersion[]
}

// ---------- Inventory ----------

export const STORAGE_CONDITIONS = [
  'refrigerated',
  'frozen',
  'room-temperature',
  'dark-refrigerated',
] as const
export type StorageCondition = (typeof STORAGE_CONDITIONS)[number]

export const LOT_STATES = [
  'active',
  'quarantined',
  'expired',
  'depleted',
  'disposed',
] as const
export type LotState = (typeof LOT_STATES)[number]

export const STOCK_STATUSES = [
  'in-stock',
  'low-stock',
  'expiring-soon',
  'expired',
  'quarantined',
  'out-of-stock',
] as const
export type StockStatus = (typeof STOCK_STATUSES)[number]

export const QC_LOT_STATUSES = ['passed', 'pending', 'failed'] as const
export type QcLotStatus = (typeof QC_LOT_STATUSES)[number]

export const STOCK_TXN_TYPES = [
  'receive',
  'consume',
  'adjust',
  'quarantine',
  'release',
  'expire',
  'transfer',
  'dispose',
  'open',
] as const
export type StockTxnType = (typeof STOCK_TXN_TYPES)[number]

export const ADJUST_REASONS = [
  'physical-count',
  'damaged',
  'spillage',
  'returned-to-vendor',
  'transfer',
  'other',
] as const
export type AdjustReason = (typeof ADJUST_REASONS)[number]

export interface StockTransaction {
  id: string
  at: number
  by: string
  type: StockTxnType
  quantity: number
  balance: number
  reason?: AdjustReason
  note?: string
  /** Storage locations for transfers. */
  fromLocationId?: string
  toLocationId?: string
}

export interface Supplier {
  id: string
  name: string
  city: string
  phone: string
  leadDays: number
}

export const LOCATION_KINDS = ['store', 'fridge', 'freezer', 'bench'] as const
export type LocationKind = (typeof LOCATION_KINDS)[number]

export interface StorageLocation {
  id: string
  name: string
  kind: LocationKind
  department?: DepartmentId
}

export interface Reagent {
  id: string
  name: string
  manufacturer: string
  department: DepartmentId
  unit: string
  storage: StorageCondition
  reorderLevel: number
  equipmentId?: string
  /** Units used per test performed on the linked analyzer. */
  perTest?: number
  testIds: string[]
  sku?: string
  supplierId?: string
}

export interface ReagentLot {
  id: string
  reagentId: string
  lotNumber: string
  receivedAt: number
  expiresAt: number
  quantity: number
  initialQuantity: number
  qcStatus: QcLotStatus
  state: LotState
  transactions: StockTransaction[]
  locationId?: string
  supplierId?: string
  openedAt?: number
}

export const CONSUMABLE_CATEGORIES = [
  'tubes',
  'syringes',
  'gloves',
  'pipette-tips',
  'slides',
  'containers',
  'labels',
  'culture-media',
  'ppe',
  'collection',
] as const
export type ConsumableCategory = (typeof CONSUMABLE_CATEGORIES)[number]

export interface Consumable {
  id: string
  name: string
  category: ConsumableCategory
  unit: string
  quantity: number
  reorderLevel: number
  location: string
  expiresAt?: number
  dailyUsage: number
  transactions: StockTransaction[]
  sku?: string
  supplierId?: string
  locationId?: string
  /** One is used for each sample collected in this container. */
  containerId?: ContainerId
}

// ---------- Equipment ----------

/**
 * operational is shown as Online; out-of-service as Error (broken down).
 * Connectivity (online / offline) is tracked separately on the analyzer.
 */
export const EQUIPMENT_STATUSES = [
  'operational',
  'standby',
  'maintenance',
  'calibration-due',
  'out-of-service',
] as const
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]

export const EQUIPMENT_LOG_TYPES = [
  'maintenance',
  'calibration',
  'breakdown',
  'status-change',
  'service-visit',
  'note',
] as const
export type EquipmentLogType = (typeof EQUIPMENT_LOG_TYPES)[number]

export interface EquipmentLog {
  id: string
  at: number
  by: string
  type: EquipmentLogType
  note: string
  status?: EquipmentStatus
  /** Engineer or vendor who performed the work. */
  performedBy?: string
  downtimeMin?: number
}

export const MAINTENANCE_KINDS = [
  'preventive',
  'corrective',
  'service',
] as const
export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number]

export interface MaintenanceTask {
  id: string
  kind: MaintenanceKind
  dueAt: number
  title: string
  assignee: string
  status: 'scheduled' | 'done'
  completedAt?: number
}

export interface CalibrationRecord {
  id: string
  at: number
  by: string
  result: 'pass' | 'fail'
  certificateNo: string
  nextDueAt: number
  remarks?: string
}

export interface Equipment {
  id: string
  name: string
  model: string
  manufacturer: string
  serialNo: string
  department: DepartmentId
  status: EquipmentStatus
  location: string
  lastMaintenanceAt: number
  nextMaintenanceAt: number
  lastCalibrationAt: number
  calibrationDueAt: number
  /** Tests per hour the analyzer can process. */
  capacityPerHour: number
  testIds: string[]
  log: EquipmentLog[]
  /** Interface link to the LIS; offline analyzers cannot receive work. */
  connection?: 'online' | 'offline'
  connectionChangedAt?: number
  connectionReason?: string
  serviceProvider?: string
  maintenancePlan?: MaintenanceTask[]
  calibrations?: CalibrationRecord[]
}

// ---------- Quality control ----------

export const QC_LEVELS = ['L1', 'L2', 'L3'] as const
export type QcLevel = (typeof QC_LEVELS)[number]

export const QC_RESULTS = ['pass', 'warning', 'fail'] as const
export type QcResult = (typeof QC_RESULTS)[number]

export const WESTGARD_RULES = ['1-2s', '1-3s', '2-2s', 'R-4s', '4-1s'] as const
export type WestgardRule = (typeof WESTGARD_RULES)[number]

export interface QcRun {
  id: string
  equipmentId: string
  analyteId: string
  level: QcLevel
  controlLot: string
  at: number
  by: string
  value: number
  mean: number
  sd: number
  result: QcResult
  rule?: WestgardRule
  correctiveAction?: string
}

export interface ControlLot {
  id: string
  equipmentId: string
  lotNumber: string
  manufacturer: string
  analyteId: string
  level: QcLevel
  mean: number
  sd: number
  expiresAt: number
}

export const QC_EVENT_STATUSES = [
  'open',
  'investigating',
  'corrective',
  'repeat-pending',
  'resolved',
] as const
export type QcEventStatus = (typeof QC_EVENT_STATUSES)[number]

export interface QcEventStep {
  id: string
  status: QcEventStatus
  at: number
  by: string
  note: string
}

/** Failed QC that must be investigated and repeated before patient runs resume. */
export interface QcEvent {
  id: string
  runId: string
  equipmentId: string
  analyteId: string
  level: QcLevel
  openedAt: number
  status: QcEventStatus
  issue?: string
  action?: string
  steps: QcEventStep[]
  resolvedByRunId?: string
  resolvedAt?: number
}

// ---------- Notifications and activity ----------

export const NOTIFICATION_TYPES = [
  'critical-detected',
  'critical-escalated',
  'sample-rejected',
  'recollection-requested',
  'report-released',
  'report-corrected',
  'report-withdrawn',
  'qc-failed',
  'equipment-down',
  'lot-quarantined',
  'result-returned',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type Severity = 'danger' | 'warning' | 'info' | 'success'

export interface LabNotification {
  id: string
  type: NotificationType
  at: number
  params: Record<string, string | number>
  link: string
  severity: Severity
  read: boolean
}

export interface ActivityEvent {
  id: string
  at: number
  by: string
  type: string
  params: Record<string, string | number>
  link?: string
}

// ---------- Aggregates for analytics ----------

export interface DailyStat {
  /** IST calendar day (YYYY-MM-DD). */
  day: string
  samples: number
  tests: number
  completed: number
  rejected: number
  criticals: number
  criticalsAcknowledged: number
  revenue: number
  tatAvgMin: number
  tatMedianMin: number
  delayedPct: number
  byDepartment: Record<DepartmentId, number>
  byEncounter: Record<EncounterType, number>
  rejectionsByReason: Partial<Record<RejectionReason, number>>
  /** Samples collected per hour of the day (24 entries). */
  byHour: number[]
  consumption: Partial<Record<ConsumableCategory, number>>
}

// ---------- Laboratory settings ----------

export interface LabSettings {
  labName: string
  reportHeader: string
  reportFooter: string
  /** Percentage of the TAT target at which a sample counts as approaching. */
  tatWarnPct: number
  /** Percentage of the TAT target at which a delay is critical. */
  tatCriticalPct: number
  samplePrefix: string
  defaultDepartment: DepartmentId | 'all'
  defaultLanguage: Language
  /** Lab identity printed on reports. */
  labAddress: string
  labRegistration: string
  labAccreditation: string
  /** Technical review must be done by someone other than the analyst. */
  requireIndependentReview: boolean
  /** Minutes within which a critical value must be communicated. */
  criticalNotifyMin: number
  /**
   * Hold a report's release until its critical values are communicated.
   * Off, release and notification may happen in either order (CAP), and the
   * open call stays on the dashboard until it is logged.
   */
  holdReleaseForCriticals: boolean
  /** Minutes a collected specimen may be in transit before it is flagged. */
  transitAlertMin: number
  /**
   * Who a critical value goes to when it is still not communicated after
   * this many minutes from detection (in order).
   */
  criticalEscalation: { afterMin: number; to: EscalationTarget }[]
  /** Days a report share link stays valid. */
  shareLinkDays: number
  /** Print a plain-language summary for the patient on lab reports. */
  patientSummaryOnReport: boolean
  billing: BillingSettings
  /** Registration and accreditation, with validity (renewal reminders). */
  profile: LabProfile
  /** Minimum retention per record class (NABL 112A Table 2 as floors). */
  retention: RetentionRule[]
  /** Modules switched on; a switched-off module leaves navigation. */
  modules: Record<ModuleId, boolean>
  sizeTier: SizeTier
  /** The rule-based Lab Assistant; its use is audited. */
  assistantEnabled: boolean
  /** Auto-verification marks passing results; off by default (kill switch). */
  autoVerifyEnabled: boolean
  /** Days within which a data principal's request is answered. */
  dataRequestDays: number
  /** Targets for the quality indicators, in percent. */
  qualityTargets: QualityTargets
}

export interface LabProfile {
  registrationNo: string
  registrationAuthority: string
  registrationValidFrom: number
  registrationValidTo: number
  nablCertificateNo?: string
  nablScope?: string
  nablValidTo?: number
  grievanceOfficer: { name: string; email: string; phone: string }
}

export interface QualityTargets {
  /** Maximum specimen rejection rate. */
  rejectionPct: number
  /** Minimum share of reports within TAT. */
  tatWithinPct: number
  /** Minimum share of criticals communicated within the limit. */
  criticalOnTimePct: number
  /** Maximum share of reports amended. */
  amendedPct: number
  /** Minimum share of EQA results acceptable. */
  eqaAcceptablePct: number
}

export const ESCALATION_TARGETS = ['lab-manager', 'duty-pathologist'] as const
export type EscalationTarget = (typeof ESCALATION_TARGETS)[number]

// ---------- Billing ----------

export const PAYMENT_METHODS = ['cash', 'card', 'upi', 'credit'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Derived (domain/billing.ts), never stored. */
export const INVOICE_STATUSES = [
  'unpaid',
  'partially-paid',
  'paid',
  'on-account',
  'refunded',
  'cancelled',
] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export interface InvoiceLine {
  id: string
  kind: 'test' | 'package' | 'charge'
  /** Test or package id. */
  refId?: string
  description: string
  /** Services Accounting Code (HSN/SAC), from Settings. */
  sac: string
  quantity: number
  /** Rupees, before discount and tax. */
  unitPrice: number
  /** GST %, from Settings (diagnostic services are often exempt: 0). */
  taxRate: number
}

export interface InvoiceDiscount {
  amount: number
  reason: string
  requestedBy: string
  requestedAt: number
  /** Discounts above the lab's limit wait for a manager's approval. */
  approvedBy?: string
  approvedAt?: number
}

export interface Payment {
  id: string
  method: PaymentMethod
  amount: number
  at: number
  by: string
  /** Card slip, UPI transaction id or account reference. */
  reference?: string
}

export interface Refund {
  id: string
  amount: number
  method: Exclude<PaymentMethod, 'credit'>
  reason: string
  at: number
  by: string
}

export interface Invoice {
  id: string
  invoiceNo: string
  patientId: string
  orderId?: string
  /** Billed to a corporate, insurance or B2B account. */
  accountId?: string
  lines: InvoiceLine[]
  discount?: InvoiceDiscount
  issuedAt: number
  issuedBy: string
  payments: Payment[]
  refunds: Refund[]
  cancelled?: { at: number; by: string; reason: string }
  /** The lab's GSTIN when issued (snapshot). */
  sellerGstin?: string
}

export const ACCOUNT_KINDS = [
  'corporate',
  'insurance',
  'hospital',
  'collection-centre',
] as const
export type AccountKind = (typeof ACCOUNT_KINDS)[number]

/** Credit (B2B) customers: billed now, paid later. */
export interface CreditAccount {
  id: string
  name: string
  kind: AccountKind
  gstin?: string
  /** Rupees the account may owe at most. */
  creditLimit: number
  /** Special prices for this account. */
  priceListId?: string
  contact: string
  active: boolean
}

export interface PriceList {
  id: string
  name: string
  /** testId -> price in rupees (tests not listed use the catalog price). */
  prices: Record<string, number>
  active: boolean
}

/** A health check or profile sold as one line at one price. */
export interface TestPackage {
  id: string
  code: string
  name: string
  testIds: string[]
  price: number
  active: boolean
}

/** The day's cash count against what the payments say. */
export interface CashClose {
  id: string
  /** IST day (YYYY-MM-DD). */
  day: string
  at: number
  by: string
  expected: Record<Exclude<PaymentMethod, 'credit'>, number>
  counted: Record<Exclude<PaymentMethod, 'credit'>, number>
  note?: string
}

export interface BillingSettings {
  /** The lab's GSTIN (15 characters), printed on invoices. */
  gstin: string
  /** Default Services Accounting Code for laboratory services. */
  defaultSac: string
  /** Default GST %; confirm with a tax adviser (often exempt: 0). */
  taxRate: number
  /** Discounts above this % of the bill need a manager's approval. */
  discountApprovalPct: number
}

// ---------- Collection centres and home collection ----------

export const CENTRE_KINDS = ['own', 'franchise', 'hospital', 'clinic'] as const
export type CentreKind = (typeof CENTRE_KINDS)[number]

/**
 * A collection centre (NABL 111): where specimens are collected and sent
 * to the lab, with its licence, person in charge and transport.
 */
export interface CollectionCentre {
  id: string
  code: string
  name: string
  kind: CentreKind
  address: string
  city: string
  pinCode: string
  phone: string
  /** Clinical establishment registration of the centre. */
  licenceNo?: string
  inchargeName: string
  inchargeQualification?: string
  /** For example "07:00-20:00, Monday to Saturday". */
  hours: string
  /** Usual transport time to the lab, minutes. */
  transitMin: number
  /** Specimens travel in a validated cold box. */
  coldChain: boolean
  /** Billed through this credit account (B2B prices). */
  accountId?: string
  active: boolean
}

export const HOME_VISIT_STATES = [
  'booked',
  'assigned',
  'en-route',
  'collected',
  'cancelled',
  'missed',
] as const
export type HomeVisitState = (typeof HOME_VISIT_STATES)[number]

export interface HomeVisit {
  id: string
  visitNo: string
  patientId: string
  /** The order whose specimens are collected at home. */
  orderId?: string
  address: string
  pinCode: string
  landmark?: string
  slotStart: number
  slotEnd: number
  phlebotomistId?: string
  state: HomeVisitState
  notes?: string
  createdAt: number
  createdBy: string
  /** Proof of collection at the door. */
  proof?: {
    at: number
    by: string
    /** Specimens kept in the cold box from the door to the lab. */
    coldChain: boolean
    /** Name of the person who signed for the visit (patient or attendant). */
    receivedBy: string
    note?: string
  }
  cancelReason?: string
  history: HistoryEntry[]
}

// ---------- Messaging ----------

export const MESSAGE_CHANNELS = ['sms', 'whatsapp', 'email'] as const
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number]

export const MESSAGE_EVENTS = [
  'report-ready',
  'report-link',
  'home-visit-booked',
  'payment-receipt',
] as const
export type MessageEvent = (typeof MESSAGE_EVENTS)[number]

/** A message the lab sends, per event, channel and language. */
export interface MessageTemplate {
  id: string
  event: MessageEvent
  channel: MessageChannel
  language: Language
  /** Text with {placeholders}; SMS needs a registered DLT template id. */
  body: string
  /** TRAI DLT template id (SMS in India). */
  dltTemplateId?: string
  active: boolean
}

export const MESSAGE_STATES = [
  'not-sent',
  'queued',
  'sent',
  'delivered',
  'failed',
] as const
export type MessageState = (typeof MESSAGE_STATES)[number]

/**
 * A message the lab tried to send. No gateway is connected in this build:
 * every message is recorded as not sent, with the reason.
 */
export interface OutboundMessage {
  id: string
  event: MessageEvent
  channel: MessageChannel
  language: Language
  to: string
  patientId?: string
  /** The report, invoice or visit it is about. */
  relatedId?: string
  text: string
  state: MessageState
  reason?: 'no-gateway' | 'opted-out' | 'no-template'
  at: number
  by: string
}

// ---------- Quality management (NABL 112A / ISO 15189) ----------

/** External quality assessment / proficiency testing outcome by z-score. */
export const EQA_OUTCOMES = ['acceptable', 'warning', 'unacceptable'] as const
export type EqaOutcome = (typeof EQA_OUTCOMES)[number]

/** One EQA/PT round for one analyte: received, submitted, then evaluated. */
export interface EqaRound {
  id: string
  provider: string
  scheme: string
  roundNo: string
  analyteId: string
  equipmentId?: string
  receivedAt: number
  dueAt: number
  submittedAt?: number
  submittedBy?: string
  reportedValue?: number
  /** From the provider's report: assigned value and SD for proficiency. */
  targetValue?: number
  targetSd?: number
  evaluatedAt?: number
  evaluatedBy?: string
  zScore?: number
  outcome?: EqaOutcome
  /** The non-conformance raised for an unacceptable result. */
  ncId?: string
}

export const NC_SOURCES = [
  'eqa',
  'iqc',
  'internal-audit',
  'complaint',
  'specimen',
  'equipment',
  'report',
  'other',
] as const
export type NcSource = (typeof NC_SOURCES)[number]

export const NC_SEVERITIES = ['minor', 'major', 'critical'] as const
export type NcSeverity = (typeof NC_SEVERITIES)[number]

/** open -> investigating -> action -> verifying -> closed (CAPA). */
export const NC_STATES = [
  'open',
  'investigating',
  'action',
  'verifying',
  'closed',
] as const
export type NcState = (typeof NC_STATES)[number]

/** A non-conformance and its corrective and preventive action (CAPA). */
export interface NonConformance {
  id: string
  ncNo: string
  source: NcSource
  severity: NcSeverity
  title: string
  description: string
  department: DepartmentId | 'all'
  /** The EQA round, audit, specimen or report it came from. */
  relatedId?: string
  raisedAt: number
  raisedBy: string
  ownerId?: string
  dueAt?: number
  correction?: string
  rootCause?: string
  correctiveAction?: string
  preventiveAction?: string
  effectiveness?: {
    at: number
    by: string
    effective: boolean
    note: string
  }
  state: NcState
  closedAt?: number
  history: HistoryEntry[]
}

export const DOCUMENT_KINDS = ['sop', 'policy', 'manual', 'form'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_STATES = [
  'draft',
  'in-review',
  'approved',
  'retired',
] as const
export type DocumentState = (typeof DOCUMENT_STATES)[number]

export interface DocumentVersion {
  version: string
  state: DocumentState
  summary: string
  createdAt: number
  createdBy: string
  approvedAt?: number
  approvedBy?: string
  effectiveFrom?: number
  retiredAt?: number
}

/** A controlled document (SOP, policy, manual, form) with its versions. */
export interface ControlledDocument {
  id: string
  code: string
  title: string
  kind: DocumentKind
  department: DepartmentId | 'all'
  /** Months between reviews of the approved version. */
  reviewMonths: number
  /** Oldest first. */
  versions: DocumentVersion[]
}

export const AUDIT_STATES = [
  'planned',
  'in-progress',
  'completed',
  'cancelled',
] as const
export type InternalAuditState = (typeof AUDIT_STATES)[number]

export const FINDING_KINDS = [
  'nonconformity',
  'observation',
  'opportunity',
] as const
export type FindingKind = (typeof FINDING_KINDS)[number]

export interface AuditFinding {
  id: string
  kind: FindingKind
  clause: string
  text: string
  /** A nonconformity raises a non-conformance. */
  ncId?: string
}

/** An internal audit (ISO 15189 clause 8.8) and its findings. */
export interface InternalAudit {
  id: string
  auditNo: string
  area: string
  /** ISO 15189:2022 clauses covered, e.g. "7.3, 7.4". */
  clauses: string
  department: DepartmentId | 'all'
  plannedFor: number
  auditorId: string
  state: InternalAuditState
  startedAt?: number
  completedAt?: number
  summary?: string
  findings: AuditFinding[]
}

export const RISK_STATES = ['open', 'treated', 'accepted', 'closed'] as const
export type RiskState = (typeof RISK_STATES)[number]

/** A risk register entry (ISO 15189 clause 8.5), scored 1-5 x 1-5. */
export interface Risk {
  id: string
  riskNo: string
  title: string
  process: string
  hazard: string
  likelihood: number
  severity: number
  controls: string
  residualLikelihood: number
  residualSeverity: number
  ownerId: string
  reviewDueAt: number
  state: RiskState
  history: HistoryEntry[]
}

/** One specimen's values compared across instrument, LIS and report. */
export interface LisCheck {
  accessionNo: string
  sampleId: string
  specimen: SpecimenId
  testCode: string
  analyte: string
  instrumentValue: string
  lisValue: string
  reportValue: string
  match: boolean
}

/**
 * An LIS verification run (NABL 112A 7.6.3): after installation and every
 * six months, values for at least ten specimens are compared between the
 * analyser, the LIS and the printed report.
 */
export interface LisVerification {
  id: string
  runNo: string
  performedAt: number
  performedBy: string
  checks: LisCheck[]
  outcome: 'pass' | 'fail'
  note?: string
  reviewedAt?: number
  reviewedBy?: string
}

// ---------- Equipment qualification and cold storage ----------

export const QUALIFICATION_KINDS = ['iq', 'oq', 'pq'] as const
export type QualificationKind = (typeof QUALIFICATION_KINDS)[number]

/** Installation, operational or performance qualification of equipment. */
export interface EquipmentQualification {
  id: string
  equipmentId: string
  kind: QualificationKind
  at: number
  by: string
  outcome: 'pass' | 'fail'
  /** Protocol or certificate reference. */
  reference: string
  note?: string
}

export const COLD_UNIT_KINDS = [
  'refrigerator',
  'freezer',
  'deep-freezer',
  'incubator',
  'room',
] as const
export type ColdUnitKind = (typeof COLD_UNIT_KINDS)[number]

export interface TemperatureReading {
  id: string
  at: number
  by: string
  /** Degrees Celsius. */
  value: number
  outOfRange: boolean
  /** Required when out of range: what was done. */
  action?: string
}

/** A refrigerator, freezer, incubator or room with a temperature log. */
export interface ColdUnit {
  id: string
  name: string
  kind: ColdUnitKind
  location: string
  department: DepartmentId | 'all'
  min: number
  max: number
  /** Newest first, capped. */
  readings: TemperatureReading[]
}

// ---------- Privacy (DPDP Act 2023 / Rules 2025) and retention ----------

export const DATA_REQUEST_KINDS = [
  'access',
  'correction',
  'erasure',
  'grievance',
  'nomination',
] as const
export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number]

export const DATA_REQUEST_STATES = [
  'received',
  'verifying',
  'in-progress',
  'completed',
  'refused',
] as const
export type DataRequestState = (typeof DATA_REQUEST_STATES)[number]

/** A data principal's request (access, correction, erasure, grievance). */
export interface DataRequest {
  id: string
  requestNo: string
  kind: DataRequestKind
  patientId?: string
  requesterName: string
  contact: string
  details: string
  receivedAt: number
  dueAt: number
  state: DataRequestState
  response?: string
  closedAt?: number
  history: HistoryEntry[]
}

export const BREACH_STATES = ['open', 'contained', 'closed'] as const
export type BreachState = (typeof BREACH_STATES)[number]

/**
 * A personal-data breach or cyber incident: CERT-In wants a report within
 * 6 hours of noticing it; the Data Protection Board the details within 72.
 */
export interface Breach {
  id: string
  breachNo: string
  title: string
  description: string
  detectedAt: number
  detectedBy: string
  affectedCount: number
  dataKinds: string
  certInReportedAt?: number
  boardReportedAt?: number
  principalsNotifiedAt?: number
  containedAt?: number
  closedAt?: number
  state: BreachState
  history: HistoryEntry[]
}

/** Reporting steps of an incident, each recorded once with a note. */
export const BREACH_STEPS = [
  'cert-in-reported',
  'board-reported',
  'principals-notified',
  'contained',
  'closed',
] as const
export type BreachStep = (typeof BREACH_STEPS)[number]

export const RECORD_CLASSES = [
  'lab-report',
  'request-form',
  'iqc-record',
  'eqa-record',
  'histopathology',
  'cytology',
  'molecular',
  'audit-log',
  'access-log',
] as const
export type RecordClass = (typeof RECORD_CLASSES)[number]

export interface RetentionRule {
  recordClass: RecordClass
  /** Minimum years kept (months for anything under a year). */
  months: number
  /** Why: the rule or policy it follows, as written by the lab. */
  basis: string
}

/** Keeps a patient's or report's records from deletion while it stands. */
export interface LegalHold {
  id: string
  entity: 'patient' | 'report'
  entityId: string
  reason: string
  placedAt: number
  placedBy: string
  releasedAt?: number
  releasedBy?: string
  releaseReason?: string
}

// ---------- Interfaces and coding ----------

export const INTERFACE_DIRECTIONS = ['in', 'out'] as const
export type InterfaceDirection = (typeof INTERFACE_DIRECTIONS)[number]

export const INTERFACE_STATES = ['processed', 'error', 'pending'] as const
export type InterfaceState = (typeof INTERFACE_STATES)[number]

export const INTERFACE_ERRORS = [
  'unmapped-code',
  'unknown-accession',
  'checksum',
  'timeout',
] as const
export type InterfaceError = (typeof INTERFACE_ERRORS)[number]

/**
 * A message between an analyser and the LIS (ASTM or HL7). Simulated in
 * this build: no analyser is connected.
 */
export interface InterfaceMessage {
  id: string
  equipmentId: string
  at: number
  direction: InterfaceDirection
  kind: 'order' | 'result' | 'query' | 'ack'
  protocol: 'ASTM' | 'HL7'
  accessionNo?: string
  instrumentCode?: string
  state: InterfaceState
  error?: InterfaceError
  retries: number
  /** A short synthetic frame, for display only. */
  frame: string
}

/** Instrument test code to the lab's analyte, per analyser, versioned. */
export interface CodeMapping {
  id: string
  equipmentId: string
  instrumentCode: string
  analyteId: string
  version: number
  updatedAt: number
  updatedBy: string
}

// ---------- Sites, modules and size ----------

export const SITE_KINDS = ['main', 'branch', 'satellite'] as const
export type SiteKind = (typeof SITE_KINDS)[number]

export interface Site {
  id: string
  code: string
  name: string
  kind: SiteKind
  city: string
  active: boolean
}

export const MODULES = [
  'billing',
  'homeCollection',
  'messaging',
  'imaging',
  'inventory',
  'quality',
  'compliance',
  'interfaces',
  'doctorPortal',
] as const
export type ModuleId = (typeof MODULES)[number]

export const SIZE_TIERS = ['small', 'medium', 'large'] as const
export type SizeTier = (typeof SIZE_TIERS)[number]

// ---------- Auto-verification and insights ----------

export const AUTOVERIFY_CHECKS = [
  'within-reference',
  'no-critical',
  'no-delta-failure',
  'no-instrument-flag',
  'qc-passed',
] as const
export type AutoVerifyCheck = (typeof AUTOVERIFY_CHECKS)[number]

export const RULE_STATES = ['draft', 'approved', 'retired'] as const
export type RuleState = (typeof RULE_STATES)[number]

/**
 * A rule-based auto-verification rule for one test (NABL 112A 7.4.1.5):
 * written, then approved by a different signatory, reviewed yearly. It
 * only marks results that pass every check; a person still authorises.
 */
export interface AutoVerifyRule {
  id: string
  testId: string
  version: number
  checks: AutoVerifyCheck[]
  state: RuleState
  createdAt: number
  createdBy: string
  approvedAt?: number
  approvedBy?: string
  retiredAt?: number
  note?: string
}

export const INSIGHT_FEEDBACK = ['accepted', 'dismissed', 'not-useful'] as const
export type InsightFeedbackKind = (typeof INSIGHT_FEEDBACK)[number]

export interface InsightFeedback {
  id: string
  insightKey: string
  kind: InsightFeedbackKind
  reason?: string
  at: number
  by: string
}

// ---------- Audit ----------

export const AUDIT_ENTITIES = [
  'patient',
  'order',
  'sample',
  'result',
  'critical',
  'report',
  'lot',
  'consumable',
  'equipment',
  'qc',
  'settings',
  'test',
  'analyte',
  'system',
  'imaging',
  'invoice',
  'quality',
  'privacy',
  'interface',
] as const
export type AuditEntity = (typeof AUDIT_ENTITIES)[number]

/** A durable record of a significant action: who, what, when and why. */
export interface AuditEntry {
  id: string
  at: number
  by: string
  entity: AuditEntity
  entityId: string
  action: string
  reason?: string
  /** State before and after the change (status values or display text). */
  from?: string
  to?: string
  /** Small context values, already display-ready. */
  detail?: Record<string, string | number>
}
