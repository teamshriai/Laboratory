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
] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

// ---------- Reference data ----------

export interface Doctor {
  id: string
  name: string
  department: ClinicalDepartmentId
  qualification: string
  phone: string
}

export interface Staff {
  id: string
  name: string
  role: StaffRole
  department?: DepartmentId
  qualification?: string
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
  'clotted-sample',
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
}

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

/**
 * A share link for a released report (demo: it opens in this browser only).
 * The URL carries the report number; a real link needs server-side access
 * control and expiry, which `expiresAt` is reserved for.
 */
export interface ReportLink {
  reportNo: string
  kind: 'laboratory' | 'imaging'
  /** Report id (laboratory) or imaging study id. */
  targetId: string
  createdAt: number
  createdBy: string
  /** The version that was current when the link was made. */
  version: number
  expiresAt?: number
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
