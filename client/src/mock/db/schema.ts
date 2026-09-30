import type {
  ActivityEvent,
  Analyte,
  Consumable,
  ControlLot,
  CriticalAlert,
  DailyStat,
  Doctor,
  Equipment,
  LabNotification,
  LabSettings,
  LabOrder,
  LabTest,
  OrderItem,
  Patient,
  QcEvent,
  QcRun,
  Reagent,
  ReagentLot,
  ReferenceRange,
  Report,
  Result,
  Sample,
  Staff,
  StorageLocation,
  Supplier,
  AuditEntry,
} from '@/domain/types'

/** Bump whenever the shape changes; stored data with another version is reseeded. */
export const SCHEMA_VERSION = 3

export const MAX_FEED_ENTRIES = 500
/** The audit log is kept longer than the feeds; entries are compact. */
export const MAX_AUDIT_ENTRIES = 2000

export const DEFAULT_SETTINGS: LabSettings = {
  labName: 'SHRI HEALTH Central Laboratory',
  reportHeader:
    'Open 24 hours, 7 days a week · Home sample collection available',
  reportFooter:
    'Results relate only to the sample received. Please correlate clinically.',
  tatWarnPct: 75,
  tatCriticalPct: 150,
  samplePrefix: 'LAB',
  defaultDepartment: 'all',
  defaultLanguage: 'en',
  labAddress: 'SHRI HEALTH Hospital, Mysuru Road, Bengaluru, Karnataka 560026',
  labRegistration: 'KA-BLR-CLE-2019-0457',
  labAccreditation: 'NABL MC-4721',
  requireIndependentReview: true,
  criticalNotifyMin: 30,
}

export type Table<T> = Record<string, T>

export interface LabDb {
  schemaVersion: number
  seededAt: number
  tests: Table<LabTest>
  analytes: Table<Analyte>
  ranges: Table<ReferenceRange>
  doctors: Table<Doctor>
  staff: Table<Staff>
  patients: Table<Patient>
  orders: Table<LabOrder>
  items: Table<OrderItem>
  samples: Table<Sample>
  results: Table<Result>
  criticals: Table<CriticalAlert>
  reports: Table<Report>
  reagents: Table<Reagent>
  lots: Table<ReagentLot>
  consumables: Table<Consumable>
  equipment: Table<Equipment>
  qcRuns: Table<QcRun>
  controlLots: Table<ControlLot>
  qcEvents: Table<QcEvent>
  suppliers: Table<Supplier>
  locations: Table<StorageLocation>
  settings: LabSettings
  /** Newest first, capped at MAX_FEED_ENTRIES. */
  notifications: LabNotification[]
  /** Newest first, capped at MAX_FEED_ENTRIES. */
  activity: ActivityEvent[]
  /** Newest first, capped at MAX_AUDIT_ENTRIES. */
  audit: AuditEntry[]
  /** Oldest first; the last 30 IST days before today. */
  dailyStats: DailyStat[]
  /** Read markers for computed summary notifications: key -> count when read. */
  summaryReads: Record<string, number>
}

export function emptyDb(now: number): LabDb {
  return {
    schemaVersion: SCHEMA_VERSION,
    seededAt: now,
    tests: {},
    analytes: {},
    ranges: {},
    doctors: {},
    staff: {},
    patients: {},
    orders: {},
    items: {},
    samples: {},
    results: {},
    criticals: {},
    reports: {},
    reagents: {},
    lots: {},
    consumables: {},
    equipment: {},
    qcRuns: {},
    controlLots: {},
    qcEvents: {},
    suppliers: {},
    locations: {},
    settings: { ...DEFAULT_SETTINGS },
    notifications: [],
    activity: [],
    audit: [],
    dailyStats: [],
    summaryReads: {},
  }
}
