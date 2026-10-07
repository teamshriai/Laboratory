// Data transfer objects returned by the lab API. Screens depend on these
// shapes, not on the database tables, so the mock can later be replaced by the
// Node backend without touching the UI.

import type { InvoiceTotals } from '@/domain/billing'
import type { DeltaCheck } from '@/domain/flags'
import type { OrderProgress, PipelineStage } from '@/domain/workflow'
import type { TatInfo } from '@/domain/tat'
import type { Uncertainty } from '@/domain/quality'
import type {
  AutoVerifyCheck,
  AutoVerifyRule,
  QcResult,
  WestgardRule,
  Breach,
  CodeMapping,
  ColdUnit,
  ControlledDocument,
  DataRequest,
  DocumentVersion,
  EqaRound,
  EquipmentQualification,
  InsightFeedbackKind,
  InterfaceMessage,
  InternalAudit,
  LabProfile,
  LegalHold,
  LisVerification,
  NonConformance,
  RetentionRule,
  Risk,
  Site,
  TemperatureReading,
  OutboundMessage,
  MessageChannel,
  MessageTemplate,
  HomeVisitState,
  HomeVisit,
  CollectionCentre,
  Doctor,
  PriceList,
  CreditAccount,
  TestPackage,
  CashClose,
  PaymentMethod,
  Refund,
  Payment,
  InvoiceDiscount,
  InvoiceLine,
  InvoiceStatus,
  ConsentRecord,
  OrderItem,
  InstrumentFlag,
  EscalationTarget,
  ReferralLab,
  Language,
  IdentityMethod,
  FastingStatus,
  ReceiptTemperature,
  SendOut,
  ShareLinkOutcome,
  ShareRevokeReason,
  StaffRole,
  ActivityEvent,
  Analyte,
  ImagingReportVersion,
  ImagingStatus,
  Modality,
  CancelReason,
  ClinicalDepartmentId,
  ClinicalNote,
  Consumable,
  ContainerId,
  CorrectionReason,
  CriticalAlert,
  CriticalState,
  DailyStat,
  DepartmentId,
  Encounter,
  EncounterType,
  Equipment,
  EquipmentStatus,
  Flag,
  HistoryEntry,
  ItemComment,
  LabNotification,
  LabTest,
  LocalName,
  NotifyAttempt,
  NotifyMethod,
  NotifyRole,
  PendingAmendment,
  OrderStatus,
  Priority,
  QcLevel,
  QcRun,
  RangeSnapshot,
  Reagent,
  ReagentLot,
  ReferenceRange,
  ReportStatus,
  ReportVersion,
  ResultRevision,
  ResultStatus,
  SampleRejection,
  SampleStatus,
  Severity,
  ShareRecord,
  Sex,
  SpecialInstruction,
  SpecimenId,
  Staff,
  StockStatus,
  QcEvent,
  ControlLot,
  Supplier,
  StorageLocation,
  StockTransaction,
  CalibrationRecord,
  MaintenanceTask,
  EquipmentLog,
  ConsumableCategory,
  LabSettings,
  BloodGroup,
  HoldReason,
  LotState,
  CollectionSite,
  AuditEntity,
  AuditEntry,
} from '@/domain/types'

export interface PatientSummary {
  id: string
  uhid: string
  name: string
  nameLocal?: LocalName
  sex: Sex
  dob: string
  mobile: string
  bloodGroup?: BloodGroup
  allergies: string[]
  encounter: Encounter
  preferredLanguage?: Language
  /** Merged into this patient (a duplicate registration). */
  mergedInto?: string
}

export interface DoctorRef {
  id: string
  name: string
  department: ClinicalDepartmentId
  phone: string
  /** Present (false) only for a doctor who takes no new orders. */
  active?: false
}

export interface StaffRef {
  id: string
  name: string
  role: Staff['role']
}

export interface TestChip {
  itemId: string
  testId: string
  code: string
  shortName: string
  name: string
  department: DepartmentId
  status: ResultStatus
  active: boolean
  /** Sent for repeat analysis and waiting for the repeat value. */
  rerun?: boolean
}

// ---------- Orders ----------

export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'all'

// ---------- Paging ----------

/** Asked of every long list; `sort` is a column key, `-key` for descending. */
export interface PageQuery {
  /** Zero-based. */
  page?: number
  pageSize?: number
  sort?: string
}

export interface PageInfo {
  /** Rows matching the filters, across all pages. */
  total: number
  /** The page returned (clamped to the last page). */
  page: number
  pageSize: number
}

export interface OrderFilters extends PageQuery {
  status?: OrderStatus | 'all'
  q?: string
  date?: DatePreset
  department?: DepartmentId
  priority?: Priority
  doctorId?: string
  testId?: string
  encounter?: EncounterType
  patientId?: string
  /** The registering site (sites master). */
  siteId?: string
}

export interface OrderRow {
  id: string
  orderNo: string | null
  status: OrderStatus
  priority: Priority
  encounter: EncounterType
  ward?: string
  bed?: string
  clinicalDepartment: ClinicalDepartmentId
  createdAt: number
  orderedAt: number | null
  patient: PatientSummary
  doctor: DoctorRef
  tests: TestChip[]
  departments: DepartmentId[]
  progress: OrderProgress
  hasRecollection: boolean
  openCriticals: number
  total: number
  tat: TatInfo | null
}

export interface OrderListResult {
  rows: OrderRow[]
  page: PageInfo
  counts: Record<OrderStatus | 'all', number>
}

export interface OrderItemDetail extends TestChip {
  price: number
  tatHours: number
  specimen: SpecimenId
  container: ContainerId
  sampleId: string | null
  accessionNo: string | null
  sampleStatus: SampleStatus | null
  reportId: string
  enteredAt?: number
  enteredBy?: string
  validatedAt?: number
  validatedBy?: string
  cancelReason?: CancelReason
  tat: TatInfo | null
}

export interface OrderDetail extends OrderRow {
  clinicalNotes: string
  createdBy: string
  cancelReason?: CancelReason
  cancelRemarks?: string
  history: HistoryEntry[]
  items: OrderItemDetail[]
  samples: SampleRow[]
  reports: {
    id: string
    reportNo: string
    department: DepartmentId
    status: ReportStatus
  }[]
  draftTestIds?: string[]
}

// ---------- Samples ----------

export interface SampleRow {
  id: string
  accessionNo: string | null
  status: SampleStatus
  stage: PipelineStage
  department: DepartmentId
  container: ContainerId
  specimen: SpecimenId
  volumeMl: number | null
  priority: Priority
  orderId: string
  orderNo: string | null
  orderedAt: number | null
  createdAt: number
  patient: PatientSummary
  encounter: EncounterType
  ward?: string
  bed?: string
  doctorId: string
  doctorName: string
  tests: TestChip[]
  instructions: SpecialInstruction[]
  fasting: boolean
  collectedAt?: number
  collectedBy?: string
  collectionSite?: CollectionSite
  receivedAt?: number
  processingStartedAt?: number
  equipment?: { id: string; name: string; status: EquipmentStatus }
  holdReason?: HoldReason
  holdRemarks?: string
  heldAt?: number
  completedAt?: number
  rejection?: SampleRejection & { byName: string }
  isRecollection: boolean
  recollectionOf?: string | null
  recollectedBy?: string | null
  labelPrintCount: number
  allEntered: boolean
  tat: TatInfo | null
  /** Tests on this specimen that need consent and do not have it yet. */
  consentMissing: { itemId: string; testName: string }[]
  /**
   * The patient's tubes still to collect now, in order of draw (CLSI GP41),
   * this one included: the phlebotomist fills them in this order.
   */
  drawOrder: {
    id: string
    container: ContainerId
    accessionNo: string | null
  }[]
  scheduledFor?: number
  scheduleReason?: string
  identityCheck?: { method: IdentityMethod; at: number; byName: string }
  fastingStatus?: FastingStatus
  receiptTemperature?: ReceiptTemperature
  temperatureDeviation?: boolean
  /** An aliquot: the specimen it was split from. */
  parent?: { id: string; accessionNo: string | null }
  aliquots: { id: string; accessionNo: string | null }[]
  sendOut?: SendOut & { labName: string; nablAccredited: boolean }
  assignedTo?: string
  assignedName?: string
}

export interface SampleFilters {
  status?: SampleStatus | 'all'
  department?: DepartmentId
  priority?: Priority
  q?: string
  scope?: 'collection' | 'processing' | 'entry'
}

export interface EquipmentOption {
  id: string
  name: string
  model: string
  status: EquipmentStatus
  qcFailedToday: boolean
}

export const MILESTONES = [
  'ordered',
  'collected',
  'received',
  'processing',
  'entered',
  'reviewed',
  'validated',
  'released',
] as const
export type Milestone = (typeof MILESTONES)[number]

export interface MilestoneEntry {
  key: Milestone
  at?: number
  byName?: string
  role?: Staff['role']
  note?: string
}

export interface SampleDetail extends SampleRow {
  milestones: MilestoneEntry[]
  history: (HistoryEntry & { byName: string })[]
  items: (TestChip & { results: ResultView[]; comments: ItemComment[] })[]
  clinicalNotes: string
  reportIds: string[]
  equipmentOptions: EquipmentOption[]
}

// ---------- Results ----------

export interface ResultView {
  id: string
  analyteId: string
  name: string
  unit: string
  value: string | null
  flag: Flag | null
  range: RangeSnapshot | null
  critical: boolean
  remarks?: string
  /** Dilution factor of a repeat analysis (10 = 1:10). */
  dilution?: number
  revisions: ResultRevision[]
  instrumentFlags?: InstrumentFlag[]
  calculated?: boolean
}

export interface PreviousResult {
  value: string
  flag: Flag | null
  at: number
}

export interface EntryAnalyte {
  analyte: Analyte
  result: ResultView | null
  /** Range the value will be judged against (snapshot if one exists). */
  range: RangeSnapshot | null
  previous: PreviousResult | null
}

export interface EntryItem {
  itemId: string
  testId: string
  testName: string
  shortName: string
  code: string
  department: DepartmentId
  method?: string
  status: ResultStatus
  returnedReason?: string
  enteredAt?: number
  enteredBy?: string
  comments: ItemComment[]
  analytes: EntryAnalyte[]
  /** Report comments the lab uses for this test. */
  commentTemplates: string[]
  /** Performed by a referral lab (results transcribed from its report). */
  performedBy?: OrderItem['performedBy']
}

export interface ResultEntryView {
  sample: SampleRow
  clinicalNotes: string
  patientNotes: ClinicalNote[]
  items: EntryItem[]
  equipmentOptions: EquipmentOption[]
}

export interface ValidationAnalyte {
  resultId: string
  analyteId: string
  name: string
  unit: string
  resultType: Analyte['resultType']
  value: string | null
  flag: Flag | null
  range: RangeSnapshot | null
  critical: boolean
  previous: PreviousResult | null
  delta: DeltaCheck | null
  remarks?: string
  /** Dilution factor of this (repeat) measurement. */
  dilution?: number
  instrumentFlags?: InstrumentFlag[]
  calculated?: boolean
  /** The value before the latest repeat analysis. */
  firstRun?: {
    value: string
    flag: Flag | null
    reason?: string
    dilution?: number
  }
}

export interface ValidationRow {
  itemId: string
  testId: string
  testName: string
  shortName: string
  department: DepartmentId
  status: ResultStatus
  enteredAt?: number
  enteredBy?: string
  enteredById?: string
  reviewedAt?: number
  reviewedBy?: string
  reviewedById?: string
  /** The sample is on hold: it must be resumed before validation. */
  sampleOnHold?: boolean
  /** An open QC failure on the analyzer: authorisation waits for QC. */
  qcHold?: { equipment: string; analyte: string }
  /** How many times the test has been repeated. */
  rerunCount?: number
  /**
   * The auto-verification rule's checks (only while switched on). Passing
   * results may be authorised together; a person still signs.
   */
  autoCheck?: { passed: boolean; failed: AutoVerifyCheck[]; version: number }
  heldReason?: string
  comments: ItemComment[]
  sampleId: string
  accessionNo: string | null
  orderId: string
  orderNo: string | null
  priority: Priority
  patient: PatientSummary
  analytes: ValidationAnalyte[]
  criticalCount: number
  abnormalCount: number
  deltaFlags: number
  alerts: Pick<CriticalAlert, 'id' | 'status'>[]
  tat: TatInfo | null
}

// ---------- Reports ----------

export interface ReportFilters extends PageQuery {
  status?: ReportStatus | 'all'
  department?: DepartmentId
  q?: string
  date?: DatePreset
  patientId?: string
}

export interface ReportRow {
  id: string
  reportNo: string
  status: ReportStatus
  department: DepartmentId
  orderId: string
  orderNo: string | null
  patient: PatientSummary
  doctorName: string
  createdAt: number
  releasedAt?: number
  version: number
  tests: string[]
  abnormalCount: number
  criticalCount: number
  renotifyPending: boolean
}

export interface ReportListResult {
  page: PageInfo
  rows: ReportRow[]
  counts: Record<ReportStatus | 'all', number>
}

export interface ReportResultRow {
  resultId: string
  analyteId: string
  name: string
  unit: string
  resultType: Analyte['resultType']
  posnegStyle?: Analyte['posnegStyle']
  value: string | null
  flag: Flag | null
  range: RangeSnapshot | null
  /** Expected (normal) values for qualitative results, e.g. "Negative". */
  expected?: string[]
  /** Values released in earlier report versions. */
  previousVersions: { version: number; value: string; flag: Flag | null }[]
  remarks?: string
}

export interface ReportSection {
  itemId: string
  testName: string
  code: string
  method?: string
  status: ResultStatus
  validatedAt?: number
  validatedBy?: string
  /** On the current released version (a preliminary report may omit it). */
  released?: boolean
  rows: ReportResultRow[]
  comments: string[]
  /** Outside the lab's NABL scope when ordered (marked on the report). */
  notAccredited?: boolean
  /** Performed by a referral lab, named on the report. */
  performedBy?: OrderItem['performedBy']
}

export interface ReportDetail {
  id: string
  reportNo: string
  status: ReportStatus
  department: DepartmentId
  version: number
  versions: (ReportVersion & {
    releasedByName: string
    requestedByName?: string
  })[]
  /** A requested correction waiting for pathologist authorisation. */
  pendingAmendment?: PendingAmendment & { requestedByName: string }
  shareLog: (ShareRecord & { byName: string })[]
  renotifyPending: boolean
  printCount: number
  interpretation?: string
  patient: PatientSummary
  order: {
    id: string
    orderNo: string | null
    orderedAt: number | null
    priority: Priority
    encounter: EncounterType
    ward?: string
    bed?: string
    clinicalDepartment: ClinicalDepartmentId
    clinicalNotes: string
    doctor: DoctorRef
    /** IP admission number or OP / ER visit number. */
    visitNo?: string
  }
  samples: {
    id: string
    accessionNo: string | null
    specimen: SpecimenId
    container: ContainerId
    collectedAt?: number
    receivedAt?: number
    status: SampleStatus
  }[]
  sections: ReportSection[]
  /** Who signed the current version (the releasing pathologist). */
  pathologist: { name: string; qualification?: string } | null
  /** Who medically authorised the results (ISO 15189 7.4.1.6 j). */
  authorisers: { name: string; qualification?: string; at: number }[]
  reviewers: { name: string; qualification?: string; at: number }[]
  enteredBy: string[]
  /** Technical reviewers of the reported results. */
  reviewedBy: string[]
  /** Tests on this report, and how many are authorised. */
  testCount: number
  authorisedCount: number
  withdrawn?: { at: number; byName: string; reason: string }
  /** Critical values on this report and how each was communicated. */
  criticals: {
    itemId: string
    analyteName: string
    value: string
    unit: string
    state: CriticalState
    notifiedTo?: string
    notifiedRole?: NotifyRole
    method?: NotifyMethod
    notifiedAt?: number
    readBack?: boolean
  }[]
  /** When the last result on the report was authorised. */
  authorisedAt?: number
  previousReports: {
    id: string
    reportNo: string
    department: DepartmentId
    releasedAt?: number
    status: ReportStatus
  }[]
  openCriticals: number
  reportedAt?: number
  /** Set when this is an earlier version: the version that replaced it. */
  supersededBy?: number
  /** The demo share link, once one has been made. */
  shareLinks: ShareLinkRow[]
  /** The viewed version's digest and verification token. */
  seal?: VersionSeal
}

/** A share link as staff see it (never the token itself). */
export interface ShareLinkRow {
  id: string
  createdAt: number
  createdByName: string
  version: number
  expiresAt: number
  state: 'active' | 'expired' | 'revoked' | 'locked'
  revokeReason?: ShareRevokeReason
  /** Successful openings. */
  opened: number
  /** Newest first, at most 20. */
  access: { at: number; outcome: ShareLinkOutcome }[]
}

/** A new link: the token is shown once, to build the URL. */
export interface CreatedShareLink {
  token: string
  link: ShareLinkRow
}

/** The issued version's seal: printed digest and QR verification token. */
export interface VersionSeal {
  digest: string
  verifyToken: string
}

/** What the public verification page (QR code) shows: no patient data. */
export interface VerificationView {
  kind: 'laboratory' | 'imaging'
  reportNo: string
  version: number
  issuedAt: number
  digest: string
  /** current: the latest version; superseded: an amendment exists. */
  status: 'current' | 'superseded' | 'withdrawn'
  labName: string
  labAccreditation: string
}

export interface CorrectionOption {
  resultId: string
  name: string
  unit: string
  value: string | null
  resultType: Analyte['resultType']
  options?: string[]
}

// ---------- Critical values ----------

export interface CriticalFilters {
  /** pending = open, contacting, notified or escalated. */
  status?: CriticalState | 'all' | 'pending'
  q?: string
}

export interface CriticalRow extends CriticalAlert {
  patient: PatientSummary
  analyteName: string
  unit: string
  testName: string
  orderNo: string | null
  accessionNo: string | null
  range: RangeSnapshot | null
  doctor: DoctorRef
  ward?: string
  bed?: string
  encounter: EncounterType
  detectedByName: string
  notifiedByName?: string
  acknowledgedByName?: string
  escalatedByName?: string
  /** The state shown to staff (open, contacting, notified, escalated...). */
  state: CriticalState
  /** Past the lab's notification window with nobody reached. */
  overdue: boolean
  /** Minutes the lab allows before a critical value must be communicated. */
  limitMin: number
  /**
   * Not yet communicated and past an escalation tier (Settings): the step
   * reached and who it goes to now.
   */
  escalationDue?: { step: number; to: EscalationTarget; afterMin: number }
  attempts: (NotifyAttempt & { byName: string })[]
  history: (HistoryEntry & { byName: string })[]
}

// ---------- Patients ----------

export interface PatientFilters extends PageQuery {
  q?: string
  encounter?: EncounterType
  flag?: 'critical' | 'abnormal' | 'active'
}

export interface PatientListResult {
  rows: PatientRow[]
  page: PageInfo
}

export interface PatientRow extends PatientSummary {
  latestOrder?: {
    id: string
    orderNo: string | null
    orderedAt: number | null
    tests: string[]
    status: OrderStatus
  }
  activeOrders: number
  openCriticals: number
  abnormalResults: number
  lastVisitAt: number
  registeredAt: number
}

export interface PatientResultRow {
  resultId: string
  itemId: string
  orderId: string
  orderNo: string | null
  analyteId: string
  name: string
  testName: string
  department: DepartmentId
  unit: string
  value: string
  flag: Flag | null
  range: RangeSnapshot | null
  at: number
  status: ResultStatus
  critical: boolean
}

export interface TrendSeries {
  analyteId: string
  name: string
  unit: string
  range: RangeSnapshot | null
  points: { at: number; value: number; flag: Flag | null }[]
}

export interface ConsentRow extends ConsentRecord {
  recordedByName: string
  withdrawnByName?: string
  /** Names of the tests a test-procedure consent covers. */
  testNames: string[]
}

export interface PatientDetail {
  patient: PatientSummary & {
    email?: string
    city: string
    state: string
    registeredAt: number
    notes: ClinicalNote[]
    attendingDoctor?: string
    pinCode?: string
    abha?: { number?: string; address?: string }
    /** Channels the patient asked not to be messaged on. */
    messagingOptOut: Partial<Record<MessageChannel, boolean>>
  }
  /** Consents on record, newest first (withdrawals included). */
  consents: ConsentRow[]
  orders: OrderRow[]
  samples: SampleRow[]
  results: PatientResultRow[]
  reports: ReportRow[]
  criticals: CriticalRow[]
  timeline: {
    id: string
    at: number
    type: string
    params: Record<string, string | number>
    byName: string
    link?: string
  }[]
  /** Laboratory and imaging reports, newest first. */
  reportHistory: PatientReportEntry[]
  trends: TrendSeries[]
}

// ---------- Catalog ----------

export interface CatalogFilters {
  q?: string
  department?: DepartmentId
  status?: 'active' | 'inactive' | 'all'
  specimen?: SpecimenId
}

export interface CatalogTest extends LabTest {
  analytes: (Analyte & { ranges: ReferenceRange[] })[]
  ordersLast30Days: number
}

export interface OrderableTest {
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
  tatHours: number
  statTatHours: number
  price: number
  analyteNames: string[]
  keywords: string[]
}

// ---------- Dashboard & work queue ----------

export interface Kpi {
  value: number
  /** Same measure at the same time yesterday, when it is known. */
  yesterday: number | null
  /** Contextual detail, e.g. how many are STAT: rendered via i18n. */
  detail?: {
    key:
      | 'stat'
      | 'oldestMin'
      | 'critical'
      | 'open'
      | 'breached'
      | 'recollect'
      | 'released'
    value: number
  }
}

export interface DashboardView {
  generatedAt: number
  kpis: {
    samplesToday: Kpi
    pendingTests: Kpi
    inProcessing: Kpi
    awaitingValidation: Kpi
    criticalResults: Kpi
    delayedTests: Kpi
    rejectedSamples: Kpi
    completedReports: Kpi
    validatedTests: Kpi
  }
  /** The last 14 complete days, oldest first (today is partial, so excluded). */
  trend: {
    days: string[]
    samples: number[]
    criticals: number[]
    delayedPct: number[]
    rejected: number[]
    completed: number[]
    /** Only for roles that may see revenue (empty otherwise). */
    revenue: number[]
  }
  tatByDepartment: {
    department: DepartmentId
    onTimePct: number
    completed: number
  }[]
  encounterMix: Record<EncounterType, number>
  /** Only for roles that may see revenue. */
  revenue?: { today: number; yesterday: number | null }
  workload: {
    department: DepartmentId
    pending: number
    processing: number
    completed: number
  }[]
  pipeline: Record<PipelineStage, number>
  criticals: CriticalRow[]
  tat: {
    onTimePct: number | null
    avgMin: number | null
    medianMin: number | null
    breached: number
    approaching: number
    worst: {
      itemId: string
      sampleId: string
      accessionNo: string | null
      testName: string
      patientName: string
      tat: TatInfo
    }[]
  }
  hourly: { hour: number; today: number; yesterday: number }[]
  activity: (ActivityEvent & { byName: string })[]
  analyzers: {
    id: string
    name: string
    model: string
    department: DepartmentId
    status: EquipmentStatus
    utilizationPct: number
    testsToday: number
    qcToday: 'pass' | 'warning' | 'fail' | 'none'
  }[]
  qcToday: { pass: number; warning: number; fail: number }
  stockAlerts: InventoryOverview['alerts']
}

export type WorkStage =
  | 'collect'
  | 'receive'
  | 'process'
  | 'enter'
  | 'validate'
  | 'acknowledge'
  | 'release'
  | 'recollect'

export interface WorkQueueItem {
  id: string
  stage: WorkStage
  title: string
  subtitle: string
  priority: Priority
  patient: PatientSummary
  since: number
  tat: TatInfo | null
  link: string
}

export interface WorkQueueView {
  stages: { stage: WorkStage; count: number; items: WorkQueueItem[] }[]
}

// ---------- Search & notifications ----------

export interface SearchExact {
  kind: 'specimen' | 'order' | 'patient' | 'report'
  id: string
  /** The identifier as recorded. */
  label: string
  patientName: string
}

export interface SearchResults {
  /** The record whose number matches the search exactly. */
  exact: SearchExact | null
  patients: PatientSummary[]
  orders: {
    id: string
    orderNo: string | null
    patientName: string
    tests: string[]
    status: OrderStatus
  }[]
  samples: {
    id: string
    accessionNo: string | null
    patientName: string
    status: SampleStatus
    department: DepartmentId
    container: ContainerId
  }[]
  tests: {
    id: string
    code: string
    name: string
    department: DepartmentId
    matchedAnalyte?: string
  }[]
  reports: {
    id: string
    reportNo: string
    patientName: string
    status: ReportStatus
    department: DepartmentId
  }[]
  equipment: {
    id: string
    name: string
    model: string
    serialNo: string
    department: DepartmentId
    status: EquipmentStatus
    connection: 'online' | 'offline'
  }[]
  /** Reagents by name or SKU, or by one of their lot numbers. */
  reagents: {
    id: string
    name: string
    department: DepartmentId
    lotId?: string
    lotNumber?: string
    lotState?: LotState
  }[]
  /** Critical values still to communicate, by patient or analyte. */
  criticals: {
    id: string
    patientName: string
    analyteName: string
    value: string
    unit: string
    state: CriticalState
  }[]
}

export type SummaryKey =
  | 'critical-pending'
  | 'tat-approaching'
  | 'lots-expiring'
  | 'recollection-pending'

export interface SummaryNotification {
  key: SummaryKey
  count: number
  severity: Severity
  link: string
  read: boolean
}

export interface NotificationsView {
  summaries: SummaryNotification[]
  items: LabNotification[]
  unread: number
}

// ---------- TAT ----------

export interface TatTestRow {
  testId: string
  testName: string
  shortName: string
  department: DepartmentId
  targetHours: number
  completed: number
  avgMin: number | null
  medianMin: number | null
  inProgress: number
  delayed: number
  onTimePct: number | null
  currentMaxMin: number | null
}

export type TatSegment = 'transport' | 'bench-wait' | 'analysis' | 'release'

export interface TatPhases {
  segments: { key: TatSegment; medianMin: number | null; count: number }[]
  /** Collection to release. */
  totalMedianMin: number | null
  count: number
}

export interface TatView {
  summary: {
    onTimePct: number | null
    avgMin: number | null
    medianMin: number | null
    delayed: number
    breachedNow: number
    approachingNow: number
  }
  tests: TatTestRow[]
  /** Median minutes per phase of completed tests, STAT kept separate. */
  phases: Record<'stat' | 'other', TatPhases>
  atRisk: {
    itemId: string
    sampleId: string
    accessionNo: string | null
    testName: string
    department: DepartmentId
    patient: PatientSummary
    priority: Priority
    tat: TatInfo
    stage: PipelineStage
  }[]
  byDepartment: {
    department: DepartmentId
    avgMin: number | null
    onTimePct: number | null
    delayed: number
  }[]
}

// ---------- Analytics ----------

export interface AnalyticsView {
  days: DailyStat[]
  today: DailyStat
}

// ---------- Inventory & equipment ----------

export interface LotRow extends ReagentLot {
  reagent: Reagent
  status: StockStatus
  daysToExpiry: number
  reagentTotal: number
  locationName: string | null
  supplierName: string | null
}

export interface ReagentSummary extends Reagent {
  totalUsable: number
  status: StockStatus
  lots: number
  nearestExpiry: number | null
}

export interface ConsumableRow extends Consumable {
  status: StockStatus
  daysLeft: number | null
}

export interface InventoryOverview {
  counts: Record<StockStatus, number>
  alerts: {
    kind: 'reagent' | 'consumable'
    id: string
    name: string
    detail: string
    status: StockStatus
    quantity: number
    unit: string
    expiresAt?: number
    link: string
  }[]
  consumption: { category: Consumable['category']; series: number[] }[]
}

export interface EquipmentRow extends Equipment {
  effectiveStatus: EquipmentStatus
  testsToday: number
  utilizationPct: number
  qcToday: 'pass' | 'warning' | 'fail' | 'none'
  maintenanceOverdue: boolean
  calibrationOverdue: boolean
  calibrationState: CalibrationState
  openQcEvents: number
  /** Samples currently processing on this analyzer. */
  runningSamples: number
}

// ---------- Quality control ----------

export interface QcFilters {
  equipmentId?: string
  analyteId?: string
  result?: QcRun['result'] | 'all'
}

export interface QcRow extends QcRun {
  equipmentName: string
  analyteName: string
  unit: string
  z: number
  byName: string
}

export interface QcSeriesKey {
  equipmentId: string
  analyteId: string
  level: QcLevel
}

export interface QcEventRow extends QcEvent {
  equipmentName: string
  analyteName: string
  unit: string
  run: QcRow | null
  steps: (QcEvent['steps'][number] & { byName: string })[]
}

export interface ControlLotRow extends ControlLot {
  equipmentName: string
  analyteName: string
  unit: string
  department: DepartmentId
}

export interface QcView {
  events: QcEventRow[]
  controlLots: ControlLotRow[]
  runs: QcRow[]
  summary: {
    runsToday: number
    passed: number
    warnings: number
    failures: number
    passRate30d: number | null
  }
  series: (QcSeriesKey & {
    equipmentName: string
    analyteName: string
    unit: string
    mean: number
    sd: number
    cv: number | null
    last: QcRun['result']
    points: {
      at: number
      value: number
      z: number
      result: QcRun['result']
      rule?: string
    }[]
  })[]
}

// ---------- Departments ----------

export interface DepartmentSummary {
  department: DepartmentId
  testsToday: number
  pending: number
  processing: number
  awaitingValidation: number
  completed: number
  delayed: number
  criticalsOpen: number
  equipment: { total: number; down: number }
  tatOnTimePct: number | null
}

export interface DepartmentDetail extends DepartmentSummary {
  queue: SampleRow[]
  tests: (OrderableTest & { orderedToday: number })[]
  equipmentRows: EquipmentRow[]
  qcToday: QcRow[]
  tat: TatTestRow[]
  staff: StaffRef[]
}

// ---------- Reference ----------

export interface ReferenceData {
  staff: Staff[]
  doctors: DoctorRef[]
  referralLabs: ReferralLab[]
}

export interface CorrectionRequest {
  corrections: { resultId: string; value: string }[]
  reason: CorrectionReason
  comments: string
}

// ---------- Work queue list ----------

/**
 * Where a sample sits in the bench workflow. A sample is in exactly one stage
 * bucket plus any of the attention buckets (critical, at-risk, overdue).
 */
export const WORK_BUCKETS = [
  'all',
  'awaiting-collection',
  'collected',
  'received',
  'processing',
  'awaiting-result',
  'awaiting-review',
  'awaiting-authorisation',
  'critical',
  'stat',
  'transit-delayed',
  'recollection',
  'at-risk',
  'overdue',
  'rejected',
  'completed',
] as const
export type WorkBucket = (typeof WORK_BUCKETS)[number]

export interface WorkQueueFilters extends PageQuery {
  bucket?: WorkBucket
  q?: string
  department?: DepartmentId
  priority?: Priority
  /** Staff id, or 'unassigned'. */
  assignee?: string
  date?: DatePreset
  container?: ContainerId
  doctorId?: string
  encounter?: EncounterType
  ward?: string
  tat?: 'on-track' | 'at-risk' | 'overdue'
}

export interface WorkQueueRow extends SampleRow {
  buckets: WorkBucket[]
  openCriticals: number
  testCount: number
  enteredCount: number
  validatedCount: number
}

export interface WorkQueueList {
  page: PageInfo
  rows: WorkQueueRow[]
  counts: Record<WorkBucket, number>
  technicians: { id: string; name: string; department?: DepartmentId }[]
  wards: string[]
  doctors: { id: string; name: string }[]
}

// ---------- Inventory items ----------

export type InventoryKind = 'reagent' | 'consumable'
export type InventoryCategory = 'reagent' | ConsumableCategory
export type ExpiryWindow = 'expired' | '7d' | '30d' | '90d'

export interface InventoryItemFilters {
  q?: string
  category?: InventoryCategory
  status?: StockStatus
  expiry?: ExpiryWindow
  locationId?: string
  supplierId?: string
}

export interface InventoryItemRow {
  kind: InventoryKind
  id: string
  name: string
  category: InventoryCategory
  department?: DepartmentId
  sku: string
  quantity: number
  unit: string
  minLevel: number
  locations: string[]
  supplierId: string | null
  supplierName: string | null
  nearestExpiry: number | null
  status: StockStatus
  lots: number
  dailyUsage: number | null
}

export interface MovementRow extends StockTransaction {
  kind: InventoryKind
  itemId: string
  itemName: string
  unit: string
  lotId?: string
  lotNumber?: string
  byName: string
  fromName?: string
  toName?: string
}

export interface InventoryItemDetail extends InventoryItemRow {
  manufacturer?: string
  storage?: Reagent['storage']
  supplier: Supplier | null
  lotRows: LotRow[]
  movements: MovementRow[]
  /** Balance before the oldest movement shown. */
  openingBalance: number
}

export interface ExpiryRow {
  kind: InventoryKind
  /** Lot id for reagents, item id for consumables. */
  id: string
  itemId: string
  name: string
  lotNumber: string | null
  expiresAt: number
  days: number
  quantity: number
  unit: string
  locationName: string | null
  state: ReagentLot['state'] | null
  window: ExpiryWindow
}

export interface InventoryMeta {
  suppliers: Supplier[]
  locations: StorageLocation[]
}

// ---------- Equipment detail ----------

export type CalibrationState = 'valid' | 'due-soon' | 'expired' | 'failed'

export interface EquipmentDetail extends EquipmentRow {
  log: (EquipmentLog & { byName: string })[]
  maintenancePlan: MaintenanceTask[]
  calibrations: (CalibrationRecord & { byName: string })[]
  qcRuns: QcRow[]
  qcEvents: QcEventRow[]
  /** Tests processed per IST day, oldest first (7 days incl. today). */
  usage: { day: string; tests: number }[]
  downtimeMin30d: number
}

// ---------- Analytics range ----------

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom'

export interface AnalyticsRange {
  preset: RangePreset
  /** YYYY-MM-DD, inclusive; only for custom. */
  from?: string
  to?: string
}

export interface TestUtilization {
  testId: string
  name: string
  shortName: string
  department: DepartmentId
  ordered: number
  abnormalPct: number | null
}

export interface AnalyticsReport {
  range: { from: string; to: string; days: number; label: RangePreset }
  /** One row per day, or per hour for single-day ranges. */
  buckets: {
    key: string
    received: number
    tests: number
    released: number
    rejected: number
    pending: number
  }[]
  bucketUnit: 'day' | 'hour'
  totals: {
    samples: number
    tests: number
    released: number
    rejected: number
    rejectionRate: number
    criticals: number
    criticalsAcknowledged: number
    /** Null for roles that may not see revenue (the server leaves it out). */
    revenue: number | null
    tatAvgMin: number | null
    delayedPct: number | null
  }
  previous: AnalyticsReport['totals'] | null
  byDepartment: {
    department: DepartmentId
    tests: number
    /** Completed tests the TAT figures are measured from. */
    tatCount: number
    tatAvgMin: number | null
    onTimePct: number | null
  }[]
  rejectionsByReason: { reason: string; count: number }[]
  byEncounter: Record<EncounterType, number>
  topTests: TestUtilization[]
  criticals: {
    detected: number
    acknowledged: number
    pending: number
    medianNotifyMin: number | null
  }
  inventory: {
    consumption: { category: ConsumableCategory; used: number }[]
    highUse: { id: string; name: string; unit: string; used: number }[]
    lowStock: number
    expiring: number
  }
}

export type { LabSettings }

// ---------- Administration ----------

export interface AuditFilters extends PageQuery {
  entity?: AuditEntity
  action?: string
  by?: string
  date?: DatePreset
  q?: string
}

export interface AuditRow extends AuditEntry {
  byName: string
  /** What the entry is about, with a link to it when it still exists. */
  record: { label: string; link?: string }
}

export interface AuditList {
  rows: AuditRow[]
  page: PageInfo
  /** Entries kept in this browser (the log is capped by storage). */
  total: number
  entities: AuditEntity[]
  actions: string[]
}

// ---------- Diagnostic imaging ----------

export interface ImagingRow {
  id: string
  accessionNo: string
  reportNo?: string
  patient: PatientSummary
  doctorName: string
  modality: Modality
  examName: string
  bodyRegion: string
  priority: Priority
  status: ImagingStatus
  scheduledAt: number
  performedAt?: number
  /** When the current version was issued. */
  reportedAt?: number
  /** Current version (0 while not reported). */
  version: number
}

export interface ImagingFilters {
  modality?: Modality
  status?: ImagingStatus | 'all'
  q?: string
}

export interface ImagingOverview {
  counts: {
    today: number
    awaitingReport: number
    reportedToday: number
    scheduled: number
    amended: number
  }
  /** Acquired and waiting for a report, oldest first. */
  awaiting: ImagingRow[]
  modalities: {
    modality: Modality
    total: number
    awaitingReport: number
    scheduled: number
    recent: ImagingRow[]
  }[]
}

export interface ImagingVersionSummary {
  version: number
  kind: ImagingReportVersion['kind']
  releasedAt: number
  reportedBy: string
  amendmentReason?: string
}

export interface ImagingReportDetail extends ImagingRow {
  indication: string
  contrast?: string
  doctor: DoctorRef
  /** The version shown; absent while the study is not reported. */
  viewing?: ImagingReportVersion
  versions: ImagingVersionSummary[]
  /** Set when an earlier version is shown. */
  supersededBy?: number
  shareLinks: ShareLinkRow[]
  /** The viewed version's digest and verification token. */
  seal?: VersionSeal
}

// ---------- Report history and the patient-facing portal ----------

/**
 * One report in a patient's history, laboratory or imaging. This is the
 * shape the future patient and doctor portals list.
 */
export interface PatientReportEntry {
  kind: 'laboratory' | 'imaging'
  id: string
  reportNo: string
  /** Laboratory department or imaging modality. */
  discipline: DepartmentId | Modality
  title: string
  status: ReportStatus | ImagingStatus
  date: number
  version: number
  /** Where the report opens in the app. */
  href: string
}

/** What a share link shows: no internal workflow fields. */
export type PublicLabReport = Omit<
  ReportDetail,
  | 'shareLog'
  | 'pendingAmendment'
  | 'previousReports'
  | 'printCount'
  | 'renotifyPending'
  | 'shareLinks'
>

export type PublicImagingReport = Omit<ImagingReportDetail, 'shareLinks'>

/** What a public page may know about the laboratory (no settings). */
export type PublicLab = Pick<
  LabSettings,
  | 'labName'
  | 'labAddress'
  | 'labRegistration'
  | 'labAccreditation'
  | 'reportHeader'
  | 'reportFooter'
  | 'patientSummaryOnReport'
>

export type PublicReport =
  | { kind: 'laboratory'; report: PublicLabReport; lab: PublicLab }
  | { kind: 'imaging'; report: PublicImagingReport; lab: PublicLab }

// ---------- Today's work (dashboard panel and assistant) ----------

export type TodaySeverity = 'critical' | 'high' | 'medium' | 'info'

export type TodayPriorityKey =
  | 'critical'
  | 'qc'
  | 'stat'
  | 'overdue'
  | 'transit'
  | 'recollection'
  | 'authorise'
  | 'imaging'

export interface TodayPriority {
  key: TodayPriorityKey
  severity: TodaySeverity
  count: number
  /** The oldest item's start (how long it has waited). */
  oldestAt?: number
  /** How many are past their limit (criticals past the notify limit). */
  overdue?: number
  to: string
}

export type TodayTodoKey =
  | 'collection'
  | 'reception'
  | 'entry'
  | 'verify'
  | 'authorise'
  | 'release'
  | 'critical'
  | 'recollection'

export interface TodayTodo {
  key: TodayTodoKey
  count: number
  /** Of these, due or overdue today. */
  dueToday: number
  oldestAt?: number
  to: string
}

export interface TodayAgendaItem {
  id: string
  kind: 'routine' | 'deadline'
  /** Routine slot key, or the deadline's kind. */
  key: string
  at: number
  state: 'done' | 'now' | 'next' | 'overdue'
  /** Deadline details (shown as recorded data). */
  label?: string
  to: string
}

export interface TodayView {
  priorities: TodayPriority[]
  todo: TodayTodo[]
  agenda: TodayAgendaItem[]
  summary: {
    ordersToday: number
    collected: number
    received: number
    inProgress: number
    verified: number
    released: number
    criticals: number
    rejected: number
  }
}

// ---------- Dashboard calendar ----------

export const BUSY_LEVELS = ['light', 'moderate', 'high'] as const
export type BusyLevel = (typeof BUSY_LEVELS)[number]

export interface CalendarDay {
  /** IST calendar day (YYYY-MM-DD). */
  day: string
  state: 'past' | 'today' | 'future'
  /** False for days outside the recorded history (and for future days). */
  hasData: boolean
  samples: number
  tests: number
  /** Tests completed (reported) that day. */
  completed: number
  rejected: number
  criticals: number
  tatAvgMin: number
  /** Imaging studies scheduled that day. */
  imaging: number
  /** Against the recorded daily average; today is compared pro rata. */
  busy?: BusyLevel
}

export interface CalendarView {
  days: CalendarDay[]
  /** Average specimens per recorded day. */
  average: number
}

// ---------- Lab Assistant ----------

export const ASSISTANT_INTENTS = [
  'attention',
  'pending',
  'critical',
  'reception',
  'verify',
  'authorise',
  'stat',
  'completed',
  'rejected',
  'delayed',
  'imaging',
  'help',
] as const
export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number]

/**
 * One line of a reply: a message key with values (shown in the reader's
 * language), or plain text (recorded data, or a future AI's own words).
 * `ms` params are durations.
 */
export type AssistantLine =
  { key: string; params?: Record<string, string | number> } | { text: string }

export interface AssistantReply {
  intent: AssistantIntent
  lines: AssistantLine[]
  bullets: AssistantLine[]
  links: { key: string; to: string }[]
  /** Where the answer came from ("Show query"): the read model and rules. */
  source?: { readModel: 'today'; at: number; rules: string }
}

// ---------- Session ----------

export interface SessionInfo {
  staffId: string
  name: string
  role: StaffRole
}

// ---------- Billing ----------

export interface InvoiceFilters extends PageQuery {
  status?: InvoiceStatus | 'all'
  q?: string
  date?: DatePreset
  accountId?: string
}

export interface InvoiceRow {
  id: string
  invoiceNo: string
  patient: PatientSummary
  orderId?: string
  orderNo?: string | null
  accountName?: string
  issuedAt: number
  status: InvoiceStatus
  total: number
  paid: number
  balance: number
  /** A discount above the limit waits for approval. */
  discountPending: boolean
}

export interface InvoiceListResult {
  rows: InvoiceRow[]
  page: PageInfo
  counts: Record<InvoiceStatus | 'all', number>
  /** Over every invoice matching the filters (all statuses). */
  totals: {
    /** Still to be paid: unpaid, part-paid and on account (rupees). */
    outstanding: number
    discountsPending: number
  }
}

export interface InvoiceDetail extends InvoiceRow {
  lines: (InvoiceLine & { amount: number })[]
  totals: InvoiceTotals
  discount?: InvoiceDiscount & {
    requestedByName: string
    approvedByName?: string
  }
  payments: (Payment & { byName: string })[]
  refunds: (Refund & { byName: string })[]
  issuedByName: string
  cancelled?: { at: number; byName: string; reason: string }
  sellerGstin?: string
  buyerGstin?: string
  lab: Pick<LabSettings, 'labName' | 'labAddress' | 'labRegistration'>
}

export interface DayBook {
  day: string
  expected: Record<'cash' | 'card' | 'upi', number>
  entries: {
    invoiceId: string
    invoiceNo: string
    patientName: string
    kind: 'payment' | 'refund'
    method: PaymentMethod
    amount: number
    at: number
    byName: string
  }[]
  close?: CashClose & { byName: string }
}

export interface BillingMasters {
  packages: TestPackage[]
  accounts: (CreditAccount & { owed: number })[]
  priceLists: PriceList[]
}

// ---------- Referring doctor ----------

export interface DoctorPatientRow {
  patient: PatientSummary
  reportCount: number
  abnormalCount: number
  criticalCount: number
  latestReportAt?: number
  latestReportId?: string
}

export interface DoctorPatientList {
  doctorName: string
  rows: DoctorPatientRow[]
  page: PageInfo
}

export interface DoctorPatientDetail {
  patient: PatientSummary
  /** Released, not withdrawn, from this doctor's orders; newest first. */
  reports: ReportRow[]
  /** Numeric results over time, abnormal analytes first. */
  trends: TrendSeries[]
  /** Analytes with a critical value on record. */
  criticalAnalytes: string[]
}

// ---------- Network: doctors, centres, home collection, messaging ----------

export interface NetworkMasters {
  doctors: (Doctor & { orders30d: number })[]
  centres: (CollectionCentre & { accountName?: string })[]
}

export interface HomeVisitRow extends Omit<HomeVisit, 'history'> {
  patient: PatientSummary
  orderNo?: string | null
  phlebotomistName?: string
  createdByName: string
  history: (HistoryEntry & { byName: string })[]
}

export interface HomeVisitFilters {
  /** IST day (YYYY-MM-DD); today by default. */
  day?: string
  state?: HomeVisitState | 'all'
  phlebotomistId?: string
}

export interface HomeVisitList {
  day: string
  rows: HomeVisitRow[]
  counts: Record<HomeVisitState | 'all', number>
  /** Each phlebotomist's route for the day, by slot. */
  routes: { staffId: string; name: string; visits: string[] }[]
}

export interface MessagingView {
  templates: MessageTemplate[]
  outbox: (OutboundMessage & {
    byName: string
    patientName?: string
    /** The report number when the message is about a report. */
    relatedLabel?: string
  })[]
}

// ---------- Quality management ----------

export const QUALITY_INDICATORS = [
  'rejection',
  'tat-within',
  'critical-on-time',
  'amended',
  'eqa-acceptable',
  'iqc-failure',
] as const
export type QualityIndicatorKey = (typeof QUALITY_INDICATORS)[number]

export interface QualityIndicator {
  key: QualityIndicatorKey
  /** Percent over the last 30 days; null without data. */
  value: number | null
  target: number
  /** Whether a higher value is better (TAT within target) or worse. */
  higherIsBetter: boolean
  status: 'met' | 'missed' | 'no-data'
  /** Weekly values, oldest first (up to 5 weeks). */
  trend: number[]
  numerator: number
  denominator: number
}

export interface QualityOverview {
  from: number
  to: number
  indicators: QualityIndicator[]
  counts: {
    ncOpen: number
    ncOverdue: number
    documentsInReview: number
    documentsReviewDue: number
    auditsPlanned: number
    risksHigh: number
    eqaPending: number
    coldExcursions7d: number
  }
  lisVerification: { lastAt: number | null; nextDueAt: number | null }
  registration: {
    validTo: number
    state: 'valid' | 'renew-now' | 'expired' | 'unknown'
    nablValidTo?: number
  }
}

export interface EqaRow extends EqaRound {
  analyteName: string
  unit: string
  equipmentName?: string
  submittedByName?: string
  evaluatedByName?: string
  ncNo?: string
  /** Not yet submitted and the due date has passed. */
  overdue: boolean
}

export interface NcRow extends Omit<NonConformance, 'history'> {
  raisedByName: string
  ownerName?: string
  overdue: boolean
  history: (HistoryEntry & { byName: string })[]
  effectivenessByName?: string
}

export interface DocumentRow extends ControlledDocument {
  current?: DocumentVersion
  /** The newest version when it is a draft or in review. */
  pending?: DocumentVersion
  reviewDueAt: number | null
  reviewOverdue: boolean
  names: Record<string, string>
}

export interface InternalAuditRow extends InternalAudit {
  auditorName: string
  ncNos: Record<string, string>
}

export interface RiskRow extends Omit<Risk, 'history'> {
  score: number
  level: 'low' | 'medium' | 'high' | 'extreme'
  residualScore: number
  residualLevel: 'low' | 'medium' | 'high' | 'extreme'
  ownerName: string
  reviewOverdue: boolean
}

export interface LisVerificationRow extends LisVerification {
  performedByName: string
  reviewedByName?: string
}

export interface UncertaintyRow {
  analyteId: string
  analyteName: string
  unit: string
  equipmentId: string
  equipmentName: string
  level: QcLevel
  /** Null with fewer than 20 IQC results in the window. */
  uncertainty: Uncertainty | null
  n: number
  /** Bias from the latest evaluated EQA round, percent, if any. */
  eqaBiasPct: number | null
}

export interface QualificationRow extends EquipmentQualification {
  equipmentName: string
  byName: string
}

export interface ColdUnitRow extends Omit<ColdUnit, 'readings'> {
  latest?: TemperatureReading & { byName: string }
  /** Last 14 days, oldest first. */
  readings: (TemperatureReading & { byName: string })[]
  excursions7d: number
  /** No reading for over 14 hours. */
  readingOverdue: boolean
}

// ---------- Registers ----------

/** One line of the Tamil Nadu Form III register (14 columns). */
export interface FormIIIRow {
  serialNo: number
  date: number
  labNo: string
  sampleId?: string
  patientName: string
  age: number
  sex: Sex
  address: string
  referredBy: string
  provisionalDiagnosis: string
  investigation: string
  specimen: SpecimenId
  methodEquipment: string
  result: string
  /** Initials of the medical officer who authorised it. */
  initials: string
  reportId?: string
  patientId: string
}

export interface RegisterResult<T> {
  rows: T[]
  page: PageInfo
  /** The register's period (YYYY-MM or YYYY-MM-DD). */
  period: string
}

export interface DailyResultRow {
  at: number
  labNo: string
  sampleId?: string
  patientId: string
  patientName: string
  investigation: string
  result: string
  abnormal: boolean
  authorisedBy: string
}

export interface IqcRegisterRow {
  at: number
  equipmentName: string
  analyteName: string
  level: QcLevel
  controlLot: string
  value: number
  mean: number
  sd: number
  result: QcResult
  rule?: WestgardRule
  byName: string
  correctiveAction?: string
}

export interface CollectionRegisterRow {
  at: number
  labNo: string
  sampleId: string
  patientId: string
  patientName: string
  specimen: SpecimenId
  container: ContainerId
  collectedBy: string
  location: string
  rejected: boolean
}

// ---------- Privacy ----------

export interface DataRequestRow extends Omit<DataRequest, 'history'> {
  patientName?: string
  overdue: boolean
  /** An active legal hold on the patient. */
  onHold: boolean
  history: (HistoryEntry & { byName: string })[]
}

export interface BreachRow extends Omit<Breach, 'history'> {
  detectedByName: string
  certInDueAt: number
  boardDueAt: number
  certInLate: boolean
  boardLate: boolean
  history: (HistoryEntry & { byName: string })[]
}

export interface LegalHoldRow extends LegalHold {
  label: string
  link: string
  placedByName: string
  releasedByName?: string
}

export interface PrivacyOverview {
  requests: DataRequestRow[]
  breaches: BreachRow[]
  holds: LegalHoldRow[]
  retention: RetentionRule[]
  dataRequestDays: number
  grievanceOfficer: LabProfile['grievanceOfficer']
}

// ---------- Interfaces and coding ----------

export interface InterfaceRow {
  equipmentId: string
  name: string
  department: DepartmentId
  connection: 'online' | 'offline'
  protocol: 'ASTM' | 'HL7'
  messagesToday: number
  errors: number
  lastMessageAt: number | null
  mapped: number
  unmapped: string[]
}

export interface InterfaceMessageRow extends InterfaceMessage {
  equipmentName: string
  /** The specimen the accession number belongs to, when it exists. */
  sampleId?: string
}

export interface CodeMappingRow extends CodeMapping {
  analyteName: string
  updatedByName: string
}

export interface CodingRow {
  analyteId: string
  name: string
  unit: string
  testNames: string[]
  loinc: string | null
  ucum: string | null
}

export interface InterfaceOverview {
  interfaces: InterfaceRow[]
  messages: InterfaceMessageRow[]
  mappings: CodeMappingRow[]
  coding: CodingRow[]
  coverage: { analytes: number; loinc: number; ucum: number }
}

// ---------- Auto-verification and insights ----------

export interface AutoVerifyRuleRow extends AutoVerifyRule {
  testName: string
  createdByName: string
  approvedByName?: string
  /** Approved over a year ago: due its annual review. */
  reviewDue: boolean
}

export const INSIGHT_KINDS = [
  'rejection-rise',
  'qc-shift',
  'tat-cluster',
  'cold-excursion',
] as const
export type InsightKind = (typeof INSIGHT_KINDS)[number]

/**
 * A rule-based suggestion, shown with its evidence: what it says, how sure
 * the rule is, why, the data window and sources, and the rule version.
 * Never a diagnosis; a person decides.
 */
export interface Insight {
  key: string
  kind: InsightKind
  params: Record<string, string | number>
  confidence: 'low' | 'medium' | 'high'
  why: { kind: string; params: Record<string, string | number> }[]
  window: { from: number; to: number }
  sources: { label: string; link: string }[]
  ruleVersion: string
  generatedAt: number
  /** The acting user's latest feedback on it, if any. */
  feedback?: InsightFeedbackKind
}

export interface SiteRow extends Site {
  orders30d: number
}
