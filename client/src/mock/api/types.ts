// Data transfer objects returned by the lab API. Screens depend on these
// shapes, not on the database tables, so the mock can later be replaced by the
// Node backend without touching the UI.

import type { DeltaCheck } from '@/domain/flags'
import type { OrderProgress, PipelineStage } from '@/domain/workflow'
import type { TatInfo } from '@/domain/tat'
import type {
  ActivityEvent,
  Analyte,
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
}

export interface DoctorRef {
  id: string
  name: string
  department: ClinicalDepartmentId
  phone: string
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

export interface OrderFilters {
  status?: OrderStatus | 'all'
  q?: string
  date?: DatePreset
  department?: DepartmentId
  priority?: Priority
  doctorId?: string
  testId?: string
  encounter?: EncounterType
  patientId?: string
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

export interface ReportFilters {
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
  attempts: (NotifyAttempt & { byName: string })[]
  history: (HistoryEntry & { byName: string })[]
}

// ---------- Patients ----------

export interface PatientFilters {
  q?: string
  encounter?: EncounterType
  flag?: 'critical' | 'abnormal' | 'active'
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

export interface PatientDetail {
  patient: PatientSummary & {
    email?: string
    city: string
    state: string
    registeredAt: number
    notes: ClinicalNote[]
    attendingDoctor?: string
  }
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
    revenue: number[]
  }
  tatByDepartment: {
    department: DepartmentId
    onTimePct: number
    completed: number
  }[]
  encounterMix: Record<EncounterType, number>
  revenue: { today: number; yesterday: number | null }
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

export interface WorkQueueFilters {
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
    revenue: number
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

export interface AuditFilters {
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
  /** Entries kept in this browser (the log is capped by storage). */
  total: number
  entities: AuditEntity[]
  actions: string[]
}
