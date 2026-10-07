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
  ImagingStudy,
  Report,
  ReportVerification,
  ShareLink,
  ConsentRecord,
  ReferralLab,
  CashClose,
  CollectionCentre,
  HomeVisit,
  MessageTemplate,
  OutboundMessage,
  CreditAccount,
  Invoice,
  PriceList,
  TestPackage,
  Result,
  Sample,
  Staff,
  StorageLocation,
  Supplier,
  AuditEntry,
  AutoVerifyRule,
  Breach,
  CodeMapping,
  ColdUnit,
  ControlledDocument,
  DataRequest,
  EqaRound,
  EquipmentQualification,
  InsightFeedback,
  InterfaceMessage,
  InternalAudit,
  LegalHold,
  LisVerification,
  NonConformance,
  Risk,
  Site,
} from '@/domain/types'

/** Bump whenever the shape changes; stored data with another version is reseeded. */
export const SCHEMA_VERSION = 10

export const MAX_FEED_ENTRIES = 500
/** The audit log is kept longer than the feeds; entries are compact. */
export const MAX_AUDIT_ENTRIES = 5000

export const DEFAULT_SETTINGS: LabSettings = {
  labName: 'SHRI HEALTH Central Laboratory',
  reportHeader:
    'Open 24 hours, 7 days a week · Home sample collection available',
  reportFooter:
    'Results relate only to the specimen received. Please correlate clinically.',
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
  holdReleaseForCriticals: true,
  transitAlertMin: 60,
  criticalEscalation: [
    { afterMin: 30, to: 'lab-manager' },
    { afterMin: 60, to: 'duty-pathologist' },
  ],
  shareLinkDays: 7,
  patientSummaryOnReport: true,
  billing: {
    // A synthetic, valid-format GSTIN for the demo lab (Karnataka, 29).
    gstin: '29AAJCS4417K1Z3',
    // 999316: medical laboratory and diagnostic-imaging services.
    defaultSac: '999316',
    // Diagnostic services of clinical establishments are usually exempt;
    // the lab's tax adviser confirms the rate.
    taxRate: 0,
    discountApprovalPct: 10,
  },
  profile: {
    registrationNo: 'KA-BLR-CLE-2019-0457',
    registrationAuthority: 'District Registering Authority, Bengaluru Urban',
    // Five-year registration; the seed moves these relative to today.
    registrationValidFrom: 0,
    registrationValidTo: 0,
    nablCertificateNo: 'MC-4721',
    nablScope:
      'Haematology, Biochemistry, Clinical Pathology, Microbiology, Serology',
    grievanceOfficer: {
      name: 'Ganesh Murthy',
      email: 'grievance@shrihealth.example',
      phone: '+91 80 4000 1234',
    },
  },
  // Floors from NABL 112A Table 2; the lab may keep records longer.
  retention: [
    {
      recordClass: 'lab-report',
      months: 1,
      basis: 'NABL 112A Table 2 (minimum)',
    },
    {
      recordClass: 'request-form',
      months: 1,
      basis: 'NABL 112A Table 2 (minimum)',
    },
    {
      recordClass: 'iqc-record',
      months: 12,
      basis: 'NABL 112A Table 2: 1 year or next assessment',
    },
    {
      recordClass: 'eqa-record',
      months: 12,
      basis: 'NABL 112A Table 2: 1 year or next assessment',
    },
    {
      recordClass: 'histopathology',
      months: 60,
      basis: 'NABL 112A Table 2: 5 years',
    },
    { recordClass: 'cytology', months: 60, basis: 'Laboratory policy' },
    {
      recordClass: 'molecular',
      months: 120,
      basis: 'NABL 112A Table 2: 10 years (genetic, cancer molecular)',
    },
    {
      recordClass: 'audit-log',
      months: 12,
      basis: 'DPDP Rules 2025, Rule 6: 1 year',
    },
    {
      recordClass: 'access-log',
      months: 12,
      basis: 'Longer of DPDP (1 year) and CERT-In (180 days)',
    },
  ],
  modules: {
    billing: true,
    homeCollection: true,
    messaging: true,
    imaging: true,
    inventory: true,
    quality: true,
    compliance: true,
    interfaces: true,
    doctorPortal: true,
  },
  sizeTier: 'large',
  assistantEnabled: true,
  autoVerifyEnabled: false,
  dataRequestDays: 30,
  qualityTargets: {
    rejectionPct: 2,
    tatWithinPct: 90,
    criticalOnTimePct: 95,
    amendedPct: 1,
    eqaAcceptablePct: 90,
  },
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
  /** Report share links by id (laboratory and imaging); tokens are hashed. */
  shareLinks: Table<ShareLink>
  /** Verification pages (QR codes) by token, one per issued version. */
  verifications: Table<ReportVerification>
  consents: Table<ConsentRecord>
  referralLabs: Table<ReferralLab>
  invoices: Table<Invoice>
  packages: Table<TestPackage>
  accounts: Table<CreditAccount>
  priceLists: Table<PriceList>
  cashCloses: Table<CashClose>
  centres: Table<CollectionCentre>
  homeVisits: Table<HomeVisit>
  templates: Table<MessageTemplate>
  /** Newest first, capped at MAX_FEED_ENTRIES. */
  outbox: OutboundMessage[]
  // Quality management
  eqaRounds: Table<EqaRound>
  ncs: Table<NonConformance>
  documents: Table<ControlledDocument>
  internalAudits: Table<InternalAudit>
  risks: Table<Risk>
  lisVerifications: Table<LisVerification>
  qualifications: Table<EquipmentQualification>
  coldUnits: Table<ColdUnit>
  // Privacy and retention
  dataRequests: Table<DataRequest>
  breaches: Table<Breach>
  legalHolds: Table<LegalHold>
  // Interfaces, sites and auto-verification
  /** Newest first, capped at MAX_FEED_ENTRIES. */
  interfaceLog: InterfaceMessage[]
  codeMappings: Table<CodeMapping>
  sites: Table<Site>
  autoVerifyRules: Table<AutoVerifyRule>
  /** Newest first, capped at MAX_FEED_ENTRIES. */
  insightFeedback: InsightFeedback[]
  imaging: Table<ImagingStudy>
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
    shareLinks: {},
    verifications: {},
    consents: {},
    referralLabs: {},
    invoices: {},
    packages: {},
    accounts: {},
    priceLists: {},
    cashCloses: {},
    centres: {},
    homeVisits: {},
    templates: {},
    outbox: [],
    eqaRounds: {},
    ncs: {},
    documents: {},
    internalAudits: {},
    risks: {},
    lisVerifications: {},
    qualifications: {},
    coldUnits: {},
    dataRequests: {},
    breaches: {},
    legalHolds: {},
    interfaceLog: [],
    codeMappings: {},
    sites: {},
    autoVerifyRules: {},
    insightFeedback: [],
    imaging: {},
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
