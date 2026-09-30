import type {
  LabOrder,
  OrderItem,
  OrderStatus,
  Report,
  ReportStatus,
  ResultStatus,
  Sample,
  SampleStatus,
} from './types'

// ---------- Sample transitions ----------

export const SAMPLE_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  pending_collection: ['collected', 'rejected', 'discarded'],
  collected: ['received', 'rejected', 'discarded'],
  received: ['processing', 'on_hold', 'rejected', 'discarded'],
  processing: ['on_hold', 'rejected', 'completed', 'discarded'],
  on_hold: ['received', 'processing', 'rejected', 'discarded'],
  completed: [],
  rejected: [],
  discarded: [],
}

export function canTransitionSample(from: SampleStatus, to: SampleStatus) {
  return SAMPLE_TRANSITIONS[from].includes(to)
}

/** Samples physically in the laboratory. */
export const IN_LAB_STATUSES: SampleStatus[] = [
  'received',
  'processing',
  'on_hold',
  'completed',
]

// ---------- Items ----------

export function isItemLive(item: Pick<OrderItem, 'active' | 'status'>) {
  return item.active && item.status !== 'void'
}

const ENTERED: ResultStatus[] = ['entered', 'reviewed', 'validated', 'held']

export function isItemEntered(item: Pick<OrderItem, 'status'>) {
  return ENTERED.includes(item.status)
}

/** Results waiting for technical review (a held result waits too). */
export function awaitsReview(item: Pick<OrderItem, 'status'>) {
  return item.status === 'entered' || item.status === 'held'
}

/** Results reviewed and waiting for pathologist authorisation. */
export function awaitsAuthorisation(item: Pick<OrderItem, 'status'>) {
  return item.status === 'reviewed'
}

/**
 * How far an item has progressed: 0 not collected, 1 collected, 2 in the lab
 * without results, 3 results entered, 4 reviewed, 5 validated.
 */
export function itemRank(item: OrderItem, sample: Sample | undefined) {
  if (item.status === 'validated') return 5
  if (item.status === 'reviewed') return 4
  if (isItemEntered(item)) return 3
  if (!sample) return 0
  if (IN_LAB_STATUSES.includes(sample.status)) return 2
  if (sample.status === 'collected') return 1
  return 0
}

// ---------- Orders ----------

export function deriveOrderStatus(
  order: Pick<LabOrder, 'state'>,
  items: OrderItem[],
  samplesById: ReadonlyMap<string, Sample>,
): OrderStatus {
  if (order.state === 'draft') return 'draft'
  if (order.state === 'cancelled') return 'cancelled'
  const live = items.filter(isItemLive)
  if (live.length === 0)
    // Items voided by a sample rejection (still active, status void) close
    // the order as rejected; tests removed from it make it cancelled.
    return items.some((i) => i.active && i.status === 'void')
      ? 'rejected'
      : 'cancelled'
  const ranks = live.map((i) =>
    itemRank(i, i.sampleId ? samplesById.get(i.sampleId) : undefined),
  )
  const min = Math.min(...ranks)
  const max = Math.max(...ranks)
  switch (min) {
    case 0:
      return max >= 1 ? 'partially-collected' : 'new'
    case 1:
      return 'collected'
    case 2:
      return max >= 3 ? 'pending-result' : 'processing'
    case 3:
      return 'awaiting-review'
    case 4:
      return 'awaiting-validation'
    default:
      return 'completed'
  }
}

export interface OrderProgress {
  total: number
  collected: number
  received: number
  entered: number
  reviewed: number
  validated: number
}

export function orderProgress(
  items: OrderItem[],
  samplesById: ReadonlyMap<string, Sample>,
): OrderProgress {
  const live = items.filter(isItemLive)
  const progress: OrderProgress = {
    total: live.length,
    collected: 0,
    received: 0,
    entered: 0,
    reviewed: 0,
    validated: 0,
  }
  for (const item of live) {
    const rank = itemRank(
      item,
      item.sampleId ? samplesById.get(item.sampleId) : undefined,
    )
    if (rank >= 1) progress.collected += 1
    if (rank >= 2) progress.received += 1
    if (rank >= 3) progress.entered += 1
    if (rank >= 4) progress.reviewed += 1
    if (rank >= 5) progress.validated += 1
  }
  return progress
}

// ---------- Reports ----------

export function deriveReportStatus(
  report: Pick<Report, 'versions' | 'pendingAmendment'>,
  items: OrderItem[],
): ReportStatus {
  if (report.pendingAmendment) return 'amendment-pending'
  if (report.versions.length > 1) return 'corrected'
  if (report.versions.length === 1) return 'released'
  const live = items.filter(isItemLive)
  if (live.length === 0) return 'draft'
  if (live.every((i) => i.status === 'validated')) return 'validated'
  if (live.every(isItemEntered)) return 'pending-validation'
  return 'draft'
}

export function isReportReleased(report: Pick<Report, 'versions'>) {
  return report.versions.length > 0
}

// ---------- Pipeline ----------

export const PIPELINE_STAGES = [
  'ordered',
  'collected',
  'received',
  'processing',
  'result-entered',
  'validated',
  'reported',
] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export function sampleStage(
  sample: Sample,
  items: OrderItem[],
  reportReleased: boolean,
): PipelineStage {
  const live = items.filter(isItemLive)
  switch (sample.status) {
    case 'pending_collection':
    case 'rejected':
    case 'discarded':
      return 'ordered'
    case 'collected':
      return 'collected'
    case 'received':
      return 'received'
    case 'on_hold':
      return sample.holdFrom === 'processing' ? 'processing' : 'received'
    case 'processing':
      return live.length > 0 && live.every(isItemEntered)
        ? 'result-entered'
        : 'processing'
    case 'completed':
      return reportReleased ? 'reported' : 'validated'
  }
}

export function stageIndex(stage: PipelineStage) {
  return PIPELINE_STAGES.indexOf(stage)
}
