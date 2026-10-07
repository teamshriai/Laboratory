// TanStack Query hooks for every lab read. Keys all start with 'lab' so a
// mutation can refresh everything that is on screen.

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DepartmentId } from '@/domain/types'
import {
  demo,
  labApi,
  type CatalogFilters,
  type CriticalFilters,
  type OrderFilters,
  type PatientFilters,
  type QcFilters,
  type ReportFilters,
  type AuditFilters,
  type SampleFilters,
  type AnalyticsRange,
  type InventoryItemFilters,
  type InventoryKind,
  type WorkQueueFilters,
  type ImagingFilters,
  type InvoiceFilters,
  type HomeVisitFilters,
  type PageQuery,
} from './lab-api'

const keep = { placeholderData: keepPreviousData }

/**
 * Screens where someone signs, releases or acknowledges never act on a
 * cached copy: they refetch whenever they open or regain focus, and treat
 * data as stale at once (another person may have changed it).
 */
const fresh = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
} as const

export const useReference = () =>
  useQuery({
    queryKey: ['lab', 'reference'],
    queryFn: labApi.reference.get,
    staleTime: 5 * 60_000,
  })
export const useOrderableTests = () =>
  useQuery({
    queryKey: ['lab', 'catalog', 'orderable'],
    queryFn: labApi.catalog.orderable,
    staleTime: 5 * 60_000,
  })

export const useDashboard = () =>
  useQuery({
    queryKey: ['lab', 'dashboard'],
    queryFn: labApi.dashboard.get,
    refetchInterval: 60_000,
  })
export const useWorkQueue = (department?: DepartmentId) =>
  useQuery({
    queryKey: ['lab', 'work-queue', department ?? 'all'],
    queryFn: () => labApi.workQueue.get(department),
    ...keep,
  })

export const usePatients = (filters: PatientFilters) =>
  useQuery({
    queryKey: ['lab', 'patients', filters],
    queryFn: () => labApi.patients.list(filters),
    ...keep,
  })
export const usePatient = (id: string | undefined) =>
  useQuery({
    queryKey: ['lab', 'patient', id],
    queryFn: () => labApi.patients.get(id!),
    enabled: Boolean(id),
  })

export const useOrders = (filters: OrderFilters) =>
  useQuery({
    queryKey: ['lab', 'orders', filters],
    queryFn: () => labApi.orders.list(filters),
    ...keep,
  })
export const useOrder = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['lab', 'order', id],
    queryFn: () => labApi.orders.get(id!),
    enabled: Boolean(id),
  })

export const useCollectionQueue = (filters: SampleFilters) =>
  useQuery({
    queryKey: ['lab', 'collection', filters],
    queryFn: () => labApi.samples.collectionQueue(filters),
    ...keep,
  })
export const useProcessing = (filters: SampleFilters) =>
  useQuery({
    queryKey: ['lab', 'processing', filters],
    queryFn: () => labApi.samples.processing(filters),
    ...keep,
  })
export const useSample = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['lab', 'sample', id],
    queryFn: () => labApi.samples.get(id!),
    enabled: Boolean(id),
  })

export const useEntryWorklist = (filters: {
  department?: DepartmentId
  q?: string
}) =>
  useQuery({
    queryKey: ['lab', 'entry-worklist', filters],
    queryFn: () => labApi.results.worklist(filters),
    ...keep,
  })
export const useResultEntry = (sampleId: string | undefined) =>
  useQuery({
    queryKey: ['lab', 'entry', sampleId],
    queryFn: () => labApi.results.entry(sampleId!),
    enabled: Boolean(sampleId),
    ...fresh,
  })
export const useValidationQueue = (filters: {
  department?: DepartmentId
  q?: string
  stage?: 'review' | 'authorise' | 'all'
}) =>
  useQuery({
    queryKey: ['lab', 'validation', filters],
    queryFn: () => labApi.validation.queue(filters),
    ...keep,
    ...fresh,
  })

export const useValidationStages = (filters: { department?: DepartmentId }) =>
  useQuery({
    queryKey: ['lab', 'validation-stages', filters],
    queryFn: () => labApi.validation.stageCounts(filters),
    ...keep,
  })

export const useReports = (filters: ReportFilters) =>
  useQuery({
    queryKey: ['lab', 'reports', filters],
    queryFn: () => labApi.reports.list(filters),
    ...keep,
  })
export const useReport = (id: string | undefined, version?: number) =>
  useQuery({
    queryKey: ['lab', 'report', id, version ?? 'current'],
    queryFn: () =>
      labApi.reports.get(id!, version !== undefined ? { version } : {}),
    enabled: Boolean(id),
    ...keep,
    ...fresh,
  })

/** One catalog test with analytes and their current ranges. */
export const useCatalogTest = (id: string | null) =>
  useQuery({
    queryKey: ['lab', 'catalog-test', id],
    queryFn: () => labApi.catalog.get(id!),
    enabled: Boolean(id),
  })

export const useCriticals = (filters: CriticalFilters) =>
  useQuery({
    queryKey: ['lab', 'criticals', filters],
    queryFn: () => labApi.critical.list(filters),
    ...keep,
    ...fresh,
  })

export const useCatalog = (filters: CatalogFilters) =>
  useQuery({
    queryKey: ['lab', 'catalog', filters],
    queryFn: () => labApi.catalog.list(filters),
    ...keep,
  })
export const useAnalytes = () =>
  useQuery({ queryKey: ['lab', 'analytes'], queryFn: labApi.catalog.analytes })

export const useInventoryOverview = () =>
  useQuery({
    queryKey: ['lab', 'inventory'],
    queryFn: labApi.inventory.overview,
  })
export const useLots = (filters: Parameters<typeof labApi.inventory.lots>[0]) =>
  useQuery({
    queryKey: ['lab', 'lots', filters],
    queryFn: () => labApi.inventory.lots(filters),
    ...keep,
  })
export const useReagents = () =>
  useQuery({
    queryKey: ['lab', 'reagents'],
    queryFn: labApi.inventory.reagents,
  })
export const useConsumables = (
  filters: Parameters<typeof labApi.inventory.consumables>[0],
) =>
  useQuery({
    queryKey: ['lab', 'consumables', filters],
    queryFn: () => labApi.inventory.consumables(filters),
    ...keep,
  })
export const useEquipment = (
  filters: Parameters<typeof labApi.equipment.list>[0],
) =>
  useQuery({
    queryKey: ['lab', 'equipment', filters],
    queryFn: () => labApi.equipment.list(filters),
    ...keep,
  })

export const useQc = (filters: QcFilters) =>
  useQuery({
    queryKey: ['lab', 'qc', filters],
    queryFn: () => labApi.qc.get(filters),
    ...keep,
  })
export const useTat = (range: 'today' | '7d') =>
  useQuery({
    queryKey: ['lab', 'tat', range],
    queryFn: () => labApi.tat.get(range),
    ...keep,
  })
export const useAnalytics = (days: 7 | 14 | 30) =>
  useQuery({
    queryKey: ['lab', 'analytics', days],
    queryFn: () => labApi.analytics.get(days),
    ...keep,
  })
export const useDepartments = () =>
  useQuery({
    queryKey: ['lab', 'departments'],
    queryFn: labApi.departments.list,
  })
export const useDepartment = (id: DepartmentId | undefined) =>
  useQuery({
    queryKey: ['lab', 'department', id],
    queryFn: () => labApi.departments.get(id!),
    enabled: Boolean(id),
  })

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ['lab', 'search', q],
    queryFn: () => labApi.search.query(q),
    enabled: q.trim().length >= 2,
    ...keep,
  })
export const useNotifications = () =>
  useQuery({
    queryKey: ['lab', 'notifications'],
    queryFn: labApi.notifications.list,
    refetchInterval: 60_000,
  })

export const useWorkQueueList = (filters: WorkQueueFilters) =>
  useQuery({
    queryKey: ['lab', 'work-queue-list', filters],
    queryFn: () => labApi.workQueue.list(filters),
    refetchInterval: 60_000,
    ...keep,
  })

export const useInventoryMeta = () =>
  useQuery({
    queryKey: ['lab', 'inventory-meta'],
    queryFn: labApi.inventory.meta,
    staleTime: 5 * 60_000,
  })
export const useInventoryItems = (filters: InventoryItemFilters) =>
  useQuery({
    queryKey: ['lab', 'inventory-items', filters],
    queryFn: () => labApi.inventory.items(filters),
    ...keep,
  })
export const useInventoryItem = (
  kind: InventoryKind | undefined,
  id: string | null | undefined,
) =>
  useQuery({
    queryKey: ['lab', 'inventory-item', kind, id],
    queryFn: () => labApi.inventory.item(kind!, id!),
    enabled: Boolean(kind && id),
  })
export const useExpiry = () =>
  useQuery({ queryKey: ['lab', 'expiry'], queryFn: labApi.inventory.expiry })
export const useMovements = (limit = 80) =>
  useQuery({
    queryKey: ['lab', 'movements', limit],
    queryFn: () => labApi.inventory.movements(limit),
  })

export const useEquipmentDetail = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['lab', 'equipment-detail', id],
    queryFn: () => labApi.equipment.get(id!),
    enabled: Boolean(id),
  })

export const useAnalyticsReport = (range: AnalyticsRange) =>
  useQuery({
    queryKey: ['lab', 'analytics-report', range],
    queryFn: () => labApi.analytics.report(range),
    ...keep,
  })

export const useLabSettings = () =>
  useQuery({
    queryKey: ['lab', 'settings'],
    queryFn: labApi.system.settings,
    staleTime: 60_000,
  })
/**
 * Who is signed in (backend builds). Its key sits outside ['lab'] so data
 * refreshes after a mutation do not refetch it.
 */
export const useSession = (enabled = true) =>
  useQuery({
    queryKey: ['session'],
    queryFn: labApi.session.get,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  })

export const useDbStats = () =>
  useQuery({ queryKey: ['lab', 'db-stats'], queryFn: () => demo.stats() })
export const useAuditLog = (filters: AuditFilters) =>
  useQuery({
    queryKey: ['lab', 'audit', filters],
    queryFn: () => labApi.admin.audit(filters),
    ...keep,
  })

// ---------- Today's work, imaging and the report portal ----------

export const useToday = () =>
  useQuery({
    queryKey: ['lab', 'today'],
    queryFn: labApi.today.get,
    refetchInterval: 60_000,
  })

/** Day-by-day figures for the dashboard calendar (YYYY-MM-DD, inclusive). */
export const useCalendar = (from: string, to: string) =>
  useQuery({
    queryKey: ['lab', 'today', 'calendar', from, to],
    queryFn: () => labApi.today.calendar({ from, to }),
    ...keep,
  })

export const useImagingOverview = () =>
  useQuery({
    queryKey: ['lab', 'imaging', 'overview'],
    queryFn: labApi.imaging.overview,
  })

export const useImagingList = (filters: ImagingFilters) =>
  useQuery({
    queryKey: ['lab', 'imaging', 'list', filters],
    queryFn: () => labApi.imaging.list(filters),
    ...keep,
  })

export const useImagingReport = (id: string | undefined, version?: number) =>
  useQuery({
    queryKey: ['lab', 'imaging', 'report', id, version ?? 'current'],
    queryFn: () =>
      labApi.imaging.report(id!, version !== undefined ? { version } : {}),
    enabled: Boolean(id),
    ...keep,
  })

/** The public verification page behind a report's QR code. */
export const useVerification = (token: string | undefined) =>
  useQuery({
    queryKey: ['public', 'verify', token],
    queryFn: () => labApi.portal.verify(token!),
    enabled: Boolean(token),
    retry: false,
  })

// ---------- Billing ----------

export const useInvoices = (filters: InvoiceFilters) =>
  useQuery({
    queryKey: ['lab', 'billing', 'list', filters],
    queryFn: () => labApi.billing.list(filters),
    ...keep,
  })

/** Payments and refunds are taken against what the invoice says now. */
export const useInvoice = (id: string | undefined) =>
  useQuery({
    queryKey: ['lab', 'billing', 'invoice', id],
    queryFn: () => labApi.billing.get(id!),
    enabled: Boolean(id),
    ...fresh,
  })

export const useOrderInvoice = (orderId: string | undefined) =>
  useQuery({
    queryKey: ['lab', 'billing', 'order', orderId],
    queryFn: () => labApi.billing.forOrder(orderId!),
    enabled: Boolean(orderId),
  })

export const useDayBook = (day?: string) =>
  useQuery({
    queryKey: ['lab', 'billing', 'day-book', day ?? 'today'],
    queryFn: () => labApi.billing.dayBook(day),
    ...fresh,
  })

export const useBillingMasters = () =>
  useQuery({
    queryKey: ['lab', 'billing', 'masters'],
    queryFn: labApi.billing.masters,
  })

// ---------- Network: doctors, centres, home visits, messages ----------

export const useNetworkMasters = () =>
  useQuery({
    queryKey: ['lab', 'network', 'masters'],
    queryFn: labApi.network.masters,
  })

export const useHomeVisits = (filters: HomeVisitFilters) =>
  useQuery({
    queryKey: ['lab', 'network', 'home-visits', filters],
    queryFn: () => labApi.network.homeVisits(filters),
    ...keep,
  })

export const useMessaging = () =>
  useQuery({
    queryKey: ['lab', 'network', 'messaging'],
    queryFn: labApi.network.messaging,
  })

// ---------- Doctor portal ----------

export const useDoctorPatients = (filters: PageQuery & { q?: string }) =>
  useQuery({
    queryKey: ['lab', 'doctor', 'patients', filters],
    queryFn: () => labApi.doctor.patients(filters),
    ...keep,
  })

export const useDoctorPatient = (id: string | undefined) =>
  useQuery({
    queryKey: ['lab', 'doctor', 'patient', id],
    queryFn: () => labApi.doctor.patient(id!),
    enabled: Boolean(id),
  })

// ---------- Quality, registers, privacy, interfaces (Wave 3) ----------

export const useQualityOverview = () =>
  useQuery({
    queryKey: ['lab', 'quality', 'overview'],
    queryFn: labApi.quality.overview,
  })
export const useEqa = () =>
  useQuery({ queryKey: ['lab', 'quality', 'eqa'], queryFn: labApi.quality.eqa })
export const useNcs = () =>
  useQuery({ queryKey: ['lab', 'quality', 'ncs'], queryFn: labApi.quality.ncs })
export const useControlledDocuments = () =>
  useQuery({
    queryKey: ['lab', 'quality', 'documents'],
    queryFn: labApi.quality.documents,
  })
export const useInternalAudits = () =>
  useQuery({
    queryKey: ['lab', 'quality', 'audits'],
    queryFn: labApi.quality.audits,
  })
export const useRisks = () =>
  useQuery({
    queryKey: ['lab', 'quality', 'risks'],
    queryFn: labApi.quality.risks,
  })
export const useLisVerifications = () =>
  useQuery({
    queryKey: ['lab', 'quality', 'lis'],
    queryFn: labApi.quality.lisVerifications,
  })
export const useUncertainty = () =>
  useQuery({
    queryKey: ['lab', 'quality', 'uncertainty'],
    queryFn: labApi.quality.uncertainty,
  })
export const useQualifications = (equipmentId?: string) =>
  useQuery({
    queryKey: ['lab', 'quality', 'qualifications', equipmentId ?? 'all'],
    queryFn: () => labApi.quality.qualifications(equipmentId),
  })
export const useColdUnits = () =>
  useQuery({
    queryKey: ['lab', 'quality', 'cold'],
    queryFn: labApi.quality.coldUnits,
  })
export const useAutoVerifyRules = () =>
  useQuery({
    queryKey: ['lab', 'autoverify'],
    queryFn: labApi.autoVerify.rules,
  })

export const useFormIII = (month: string, query: PageQuery) =>
  useQuery({
    queryKey: ['lab', 'registers', 'form-iii', month, query],
    queryFn: () => labApi.registers.formIII(month, query),
    ...keep,
  })
export const useDailyRegister = (day: string, query: PageQuery) =>
  useQuery({
    queryKey: ['lab', 'registers', 'daily', day, query],
    queryFn: () => labApi.registers.daily(day, query),
    ...keep,
  })
export const useIqcRegister = (month: string, query: PageQuery) =>
  useQuery({
    queryKey: ['lab', 'registers', 'iqc', month, query],
    queryFn: () => labApi.registers.iqc(month, query),
    ...keep,
  })
export const useCollectionRegister = (day: string, query: PageQuery) =>
  useQuery({
    queryKey: ['lab', 'registers', 'collection', day, query],
    queryFn: () => labApi.registers.collection(day, query),
    ...keep,
  })

export const usePrivacy = () =>
  useQuery({ queryKey: ['lab', 'privacy'], queryFn: labApi.privacy.overview })
export const useInterfaces = () =>
  useQuery({
    queryKey: ['lab', 'interfaces'],
    queryFn: labApi.interfaces.overview,
    refetchInterval: 60_000,
  })
export const useSites = () =>
  useQuery({ queryKey: ['lab', 'sites'], queryFn: labApi.sites.list })
export const useInsights = () =>
  useQuery({ queryKey: ['lab', 'insights'], queryFn: labApi.insights.list })
