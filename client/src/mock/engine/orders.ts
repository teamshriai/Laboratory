import { groupTestsIntoSamples, sampleKey } from '@/domain/grouping'
import { nextSequence, orderPrefix, reportPrefix, uid } from '@/domain/ids'
import { tatHoursFor } from '@/domain/tat'
import {
  CANCEL_REASONS,
  type CancelReason,
  type ClinicalDepartmentId,
  type DepartmentId,
  type EncounterType,
  type LabOrder,
  type LabTest,
  type OrderItem,
  type Priority,
  type Report,
  type Sample,
} from '@/domain/types'
import {
  IN_LAB_STATUSES,
  isItemEntered,
  isItemLive,
  isReportReleased,
} from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import { voidAlert } from './critical'
import {
  audit,
  history,
  itemsOfOrder,
  itemsOfSample,
  LabApiError,
  logActivity,
  must,
  requirePermission,
  samplesOfOrder,
  type EngineCtx,
} from './core'

/** A cancellation reason from the list; "other" needs remarks. */
function checkCancelReason(input: { reason: CancelReason; remarks?: string }) {
  if (!CANCEL_REASONS.includes(input.reason))
    throw new LabApiError('validation-failed', { field: 'reason' })
  if (input.reason === 'other' && !input.remarks?.trim())
    throw new LabApiError('reason-required')
  return input.remarks?.trim()
    ? `${input.reason}: ${input.remarks.trim()}`
    : input.reason
}

export interface OrderInput {
  patientId: string
  doctorId: string
  department: ClinicalDepartmentId
  encounter: EncounterType
  ward?: string
  bed?: string
  priority: Priority
  clinicalNotes: string
  testIds: string[]
}

function activeTests(db: LabDb, testIds: string[]): LabTest[] {
  const unique = [...new Set(testIds)]
  return unique.map((id) => {
    const test = must(db.tests, id, 'test')
    if (!test.active)
      throw new LabApiError('test-inactive', { test: test.name })
    return test
  })
}

function newReport(
  db: LabDb,
  order: LabOrder,
  department: DepartmentId,
  ctx: EngineCtx,
): Report {
  const report: Report = {
    id: uid('rpt'),
    reportNo: nextSequence(
      Object.values(db.reports).map((r) => r.reportNo),
      reportPrefix(ctx.now),
      4,
    ),
    orderId: order.id,
    patientId: order.patientId,
    department,
    createdAt: ctx.now,
    versions: [],
    shareLog: [],
    printCount: 0,
  }
  db.reports[report.id] = report
  return report
}

function newSample(
  db: LabDb,
  order: LabOrder,
  req: Pick<Sample, 'department' | 'container' | 'specimen' | 'volumeMl'>,
  ctx: EngineCtx,
): Sample {
  const sample: Sample = {
    id: uid('smp'),
    accessionNo: null,
    orderId: order.id,
    patientId: order.patientId,
    department: req.department,
    container: req.container,
    specimen: req.specimen,
    volumeMl: req.volumeMl,
    status: 'pending_collection',
    createdAt: ctx.now,
    labelPrintCount: 0,
    history: [history(ctx, 'created')],
  }
  db.samples[sample.id] = sample
  return sample
}

function newItem(
  order: LabOrder,
  test: LabTest,
  sampleId: string,
  reportId: string,
): OrderItem {
  return {
    id: uid('itm'),
    orderId: order.id,
    testId: test.id,
    testCode: test.code,
    testName: test.name,
    department: test.department,
    specimen: test.specimen,
    container: test.container,
    price: test.price,
    tatHours: tatHoursFor(test, order.priority),
    analyteIds: [...test.analyteIds],
    active: true,
    sampleId,
    status: 'pending',
    comments: [],
    reportId,
  }
}

/** Creates samples, items and reports for an order that is being placed. */
function materialize(
  db: LabDb,
  order: LabOrder,
  tests: LabTest[],
  ctx: EngineCtx,
) {
  const reports = new Map<DepartmentId, Report>()
  for (const req of groupTestsIntoSamples(tests)) {
    const sample = newSample(db, order, req, ctx)
    for (const testId of req.testIds) {
      const test = tests.find((t) => t.id === testId)!
      let report = reports.get(test.department)
      if (!report) {
        report = newReport(db, order, test.department, ctx)
        reports.set(test.department, report)
      }
      const item = newItem(order, test, sample.id, report.id)
      db.items[item.id] = item
    }
  }
}

function assignOrderNo(db: LabDb, ctx: EngineCtx) {
  return nextSequence(
    Object.values(db.orders).map((o) => o.orderNo),
    orderPrefix(ctx.now),
    4,
  )
}

export function createOrder(
  db: LabDb,
  input: OrderInput & { draft?: boolean },
  ctx: EngineCtx,
): LabOrder {
  requirePermission(db, ctx, 'order.create')
  const patient = must(db.patients, input.patientId, 'patient')
  must(db.doctors, input.doctorId, 'doctor')
  if (input.testIds.length === 0) throw new LabApiError('order-empty')
  const tests = activeTests(db, input.testIds)

  const order: LabOrder = {
    id: uid('ord'),
    orderNo: input.draft ? null : assignOrderNo(db, ctx),
    patientId: patient.id,
    doctorId: input.doctorId,
    department: input.department,
    encounter: input.encounter,
    priority: input.priority,
    clinicalNotes: input.clinicalNotes.trim(),
    state: input.draft ? 'draft' : 'active',
    createdAt: ctx.now,
    createdBy: ctx.by,
    orderedAt: input.draft ? null : ctx.now,
    history: [history(ctx, input.draft ? 'draft-saved' : 'ordered')],
  }
  if (input.ward) order.ward = input.ward
  if (input.bed) order.bed = input.bed
  db.orders[order.id] = order

  if (input.draft) {
    order.draftTestIds = tests.map((t) => t.id)
    audit(db, ctx, 'order', order.id, 'draft-saved', { to: 'draft' })
  } else {
    materialize(db, order, tests, ctx)
    audit(db, ctx, 'order', order.id, 'placed', {
      to: 'new',
      detail: { orderNo: order.orderNo!, tests: tests.length },
    })
    logActivity(
      db,
      ctx,
      'order-created',
      { orderNo: order.orderNo!, patient: patient.name, tests: tests.length },
      `/orders?order=${order.id}`,
    )
  }
  return order
}

export function updateDraft(
  db: LabDb,
  orderId: string,
  input: OrderInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'order.create')
  const order = must(db.orders, orderId, 'order')
  if (order.state !== 'draft') throw new LabApiError('invalid-transition')
  if (input.testIds.length === 0) throw new LabApiError('order-empty')
  const tests = activeTests(db, input.testIds)
  Object.assign(order, {
    patientId: input.patientId,
    doctorId: input.doctorId,
    department: input.department,
    encounter: input.encounter,
    ward: input.ward,
    bed: input.bed,
    priority: input.priority,
    clinicalNotes: input.clinicalNotes.trim(),
    draftTestIds: tests.map((t) => t.id),
  })
  order.history.push(history(ctx, 'draft-saved'))
  return order
}

export function submitDraft(
  db: LabDb,
  orderId: string,
  input: OrderInput,
  ctx: EngineCtx,
) {
  const order = updateDraft(db, orderId, input, ctx)
  const tests = activeTests(db, order.draftTestIds ?? [])
  order.state = 'active'
  order.orderNo = assignOrderNo(db, ctx)
  order.orderedAt = ctx.now
  delete order.draftTestIds
  order.history.push(history(ctx, 'ordered'))
  materialize(db, order, tests, ctx)
  audit(db, ctx, 'order', order.id, 'placed', {
    from: 'draft',
    to: 'new',
    detail: { orderNo: order.orderNo, tests: tests.length },
  })
  const patient = must(db.patients, order.patientId, 'patient')
  logActivity(
    db,
    ctx,
    'order-created',
    { orderNo: order.orderNo, patient: patient.name, tests: tests.length },
    `/orders?order=${order.id}`,
  )
  return order
}

/** A draft has no clinical record yet, so it is deleted (and audited). */
export function discardDraft(db: LabDb, orderId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'order.create')
  const order = must(db.orders, orderId, 'order')
  if (order.state !== 'draft') throw new LabApiError('invalid-transition')
  delete db.orders[orderId]
  audit(db, ctx, 'order', orderId, 'draft-discarded', { from: 'draft' })
}

/** Discards a sample once nothing live remains on it. */
function discardIfEmpty(db: LabDb, sampleId: string | null, ctx: EngineCtx) {
  if (!sampleId) return
  const sample = db.samples[sampleId]
  if (!sample || ['completed', 'rejected', 'discarded'].includes(sample.status))
    return
  if (itemsOfSample(db, sampleId).some(isItemLive)) return
  sample.status = 'discarded'
  sample.history.push(history(ctx, 'discarded'))
}

export function cancelOrder(
  db: LabDb,
  orderId: string,
  input: { reason: CancelReason; remarks?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'order.cancel')
  const order = must(db.orders, orderId, 'order')
  if (order.state !== 'active') throw new LabApiError('invalid-transition')
  const reason = checkCancelReason(input)
  const items = itemsOfOrder(db, orderId)
  if (!items.some(isItemLive))
    throw new LabApiError('order-closed', { status: 'rejected' })
  if (items.some((i) => i.active && i.status === 'validated'))
    throw new LabApiError('order-has-validated-results')
  // Once the laboratory has a specimen, withdraw individual tests instead,
  // so work already done stays on the record.
  const inLab = samplesOfOrder(db, orderId).find((s) =>
    IN_LAB_STATUSES.includes(s.status),
  )
  if (inLab)
    throw new LabApiError('order-in-lab', {
      accession: inLab.accessionNo ?? '',
    })
  for (const item of items) {
    if (!item.active) continue
    item.active = false
    item.cancelledAt = ctx.now
    item.cancelledBy = ctx.by
    item.cancelReason = input.reason
  }
  for (const sample of samplesOfOrder(db, orderId))
    discardIfEmpty(db, sample.id, ctx)
  voidCriticalsForOrder(db, orderId, ctx, 'order-cancelled')
  order.state = 'cancelled'
  order.cancelReason = input.reason
  order.cancelledAt = ctx.now
  order.cancelledBy = ctx.by
  if (input.remarks) order.cancelRemarks = input.remarks
  order.history.push(history(ctx, 'cancelled', { reason: input.reason }))
  audit(db, ctx, 'order', order.id, 'cancelled', {
    reason,
    from: 'active',
    to: 'cancelled',
    detail: { orderNo: order.orderNo ?? '' },
  })
  const patient = db.patients[order.patientId]
  logActivity(
    db,
    ctx,
    'order-cancelled',
    { orderNo: order.orderNo ?? '', patient: patient?.name ?? '' },
    `/orders?order=${order.id}`,
  )
  return order
}

function voidCriticalsForOrder(
  db: LabDb,
  orderId: string,
  ctx: EngineCtx,
  reason: string,
) {
  for (const alert of Object.values(db.criticals)) {
    if (alert.orderId !== orderId) continue
    voidAlert(alert, reason, ctx)
  }
}

export function setPriority(
  db: LabDb,
  orderId: string,
  priority: Priority,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'order.create')
  const order = must(db.orders, orderId, 'order')
  if (order.state === 'cancelled') throw new LabApiError('invalid-transition')
  if (order.priority === priority) return order
  const from = order.priority
  order.priority = priority
  for (const item of itemsOfOrder(db, orderId)) {
    if (!isItemLive(item) || item.status === 'validated') continue
    const test = db.tests[item.testId]
    if (test) item.tatHours = tatHoursFor(test, priority)
  }
  order.history.push(history(ctx, 'priority-changed', { from, to: priority }))
  audit(db, ctx, 'order', order.id, 'priority-changed', {
    from,
    to: priority,
  })
  logActivity(
    db,
    ctx,
    'priority-changed',
    { orderNo: order.orderNo ?? '', priority },
    `/orders?order=${order.id}`,
  )
  return order
}

const ATTACHABLE: Sample['status'][] = [
  'pending_collection',
  'collected',
  'received',
  'processing',
  'on_hold',
]

export function addTests(
  db: LabDb,
  orderId: string,
  testIds: string[],
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'order.create')
  const order = must(db.orders, orderId, 'order')
  if (order.state !== 'active') throw new LabApiError('invalid-transition')
  const tests = activeTests(db, testIds)
  const existing = itemsOfOrder(db, orderId)
  for (const test of tests) {
    if (existing.some((i) => isItemLive(i) && i.testId === test.id))
      throw new LabApiError('duplicate-test', { test: test.name })
  }
  const samples = samplesOfOrder(db, orderId)
  for (const test of tests) {
    const key = sampleKey(test)
    let sample = samples.find(
      (s) => sampleKey(s) === key && ATTACHABLE.includes(s.status),
    )
    if (!sample) {
      sample = newSample(db, order, { ...test }, ctx)
      samples.push(sample)
    } else {
      sample.history.push(history(ctx, 'test-added', { test: test.shortName }))
    }
    let report = Object.values(db.reports).find(
      (r) =>
        r.orderId === orderId &&
        r.department === test.department &&
        !isReportReleased(r),
    )
    if (!report) report = newReport(db, order, test.department, ctx)
    const item = newItem(order, test, sample.id, report.id)
    db.items[item.id] = item
    existing.push(item)
    // A new test on a sample already in the lab puts it back into processing.
    if (sample.status === 'completed') sample.status = 'processing'
  }
  order.history.push(
    history(ctx, 'tests-added', {
      tests: tests.map((t) => t.shortName).join(', '),
    }),
  )
  audit(db, ctx, 'order', order.id, 'tests-added', {
    detail: { tests: tests.map((t) => t.shortName).join(', ') },
  })
  return order
}

export function removeItem(
  db: LabDb,
  itemId: string,
  input: { reason: CancelReason; remarks?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'order.cancel')
  const item = must(db.items, itemId, 'item')
  if (!item.active) throw new LabApiError('invalid-transition')
  const reason = checkCancelReason(input)
  if (item.status === 'validated')
    throw new LabApiError('item-already-validated')
  // A test with a result on record is corrected or reported, not cancelled.
  if (isItemEntered(item))
    throw new LabApiError('test-resulted', { test: item.testName })
  const order = must(db.orders, item.orderId, 'order')
  item.active = false
  item.cancelledAt = ctx.now
  item.cancelledBy = ctx.by
  item.cancelReason = input.reason
  for (const alert of Object.values(db.criticals)) {
    if (
      alert.orderItemId === itemId &&
      (alert.status === 'open' || alert.status === 'notified')
    ) {
      voidAlert(alert, 'test-removed', ctx)
    }
  }
  discardIfEmpty(db, item.sampleId, ctx)
  if (!itemsOfOrder(db, order.id).some(isItemLive)) {
    order.state = 'cancelled'
    order.cancelReason = input.reason
  }
  order.history.push(
    history(ctx, 'test-removed', { test: item.testName, reason: input.reason }),
  )
  audit(db, ctx, 'order', order.id, 'test-removed', {
    reason,
    from: item.status,
    to: 'cancelled',
    detail: { test: item.testName },
  })
  return item
}
