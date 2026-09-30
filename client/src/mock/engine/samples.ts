import { accessionPrefix, nextSequence, uid } from '@/domain/ids'
import {
  COLLECTION_FAILURE_REASONS,
  HOLD_REASONS,
  REJECTION_REASONS,
  type CollectionFailureReason,
  type CollectionSite,
  type HoldReason,
  type RejectionReason,
  type Sample,
} from '@/domain/types'
import { canTransitionSample, isItemLive } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import { voidAlert } from './critical'
import { consumeReagentsFor } from './inventory'
import { completeSampleIfDone } from './results'
import {
  audit,
  history,
  itemsOfSample,
  LabApiError,
  logActivity,
  must,
  notify,
  resultsOfItem,
  staffName,
  type EngineCtx,
} from './core'

function transition(sample: Sample, to: Sample['status']) {
  if (!canTransitionSample(sample.status, to))
    throw new LabApiError('invalid-transition', { from: sample.status, to })
  sample.status = to
}

function ensureAccession(db: LabDb, sample: Sample, ctx: EngineCtx) {
  if (sample.accessionNo) return sample.accessionNo
  sample.accessionNo = nextSequence(
    Object.values(db.samples).map((s) => s.accessionNo),
    accessionPrefix(ctx.now, db.settings.samplePrefix),
    5,
  )
  return sample.accessionNo
}

const sampleLink = (s: Sample) => `/laboratory/samples/${s.id}`

export function printLabel(db: LabDb, sampleId: string, ctx: EngineCtx) {
  const sample = must(db.samples, sampleId, 'sample')
  if (['rejected', 'discarded'].includes(sample.status))
    throw new LabApiError('invalid-transition')
  ensureAccession(db, sample, ctx)
  sample.labelPrintedAt = ctx.now
  sample.labelPrintCount += 1
  sample.history.push(
    history(ctx, 'label-printed', { count: sample.labelPrintCount }),
  )
  return sample
}

export interface CollectInput {
  collectedAt: number
  collectedBy: string
  site: CollectionSite
  remarks?: string
}

export function collectSample(
  db: LabDb,
  sampleId: string,
  input: CollectInput,
  ctx: EngineCtx,
) {
  const sample = must(db.samples, sampleId, 'sample')
  must(db.staff, input.collectedBy, 'staff')
  const order = must(db.orders, sample.orderId, 'order')
  if (
    input.collectedAt > ctx.now + 60_000 ||
    (order.orderedAt && input.collectedAt < order.orderedAt - 60_000)
  )
    throw new LabApiError('validation-failed', { field: 'collectedAt' })
  transition(sample, 'collected')
  ensureAccession(db, sample, ctx)
  consumeContainer(db, sample, ctx)
  sample.collectedAt = input.collectedAt
  sample.collectedBy = input.collectedBy
  sample.collectionSite = input.site
  if (input.remarks) sample.collectionRemarks = input.remarks
  sample.history.push({
    ...history(ctx, 'collected'),
    at: input.collectedAt,
    by: input.collectedBy,
  })
  const patient = db.patients[sample.patientId]
  logActivity(
    db,
    ctx,
    'sample-collected',
    { accession: sample.accessionNo!, patient: patient?.name ?? '' },
    sampleLink(sample),
  )
  return sample
}

/** Receives a sample in the lab by accession number (scanned) or id. */
export function receiveSample(db: LabDb, ref: string, ctx: EngineCtx) {
  const key = ref.trim().toUpperCase()
  const sample =
    db.samples[ref] ??
    Object.values(db.samples).find((s) => s.accessionNo?.toUpperCase() === key)
  if (!sample) throw new LabApiError('not-found', { entity: 'sample', id: ref })
  if (sample.status === 'pending_collection')
    throw new LabApiError('sample-not-collected', {
      accession: sample.accessionNo ?? ref,
    })
  if (sample.status !== 'collected')
    throw new LabApiError('sample-already-received', {
      accession: sample.accessionNo ?? ref,
    })
  transition(sample, 'received')
  sample.receivedAt = ctx.now
  sample.receivedBy = ctx.by
  sample.history.push(history(ctx, 'received'))
  const patient = db.patients[sample.patientId]
  logActivity(
    db,
    ctx,
    'sample-received',
    { accession: sample.accessionNo!, patient: patient?.name ?? '' },
    sampleLink(sample),
  )
  return sample
}

/**
 * An unresolved QC failure on this analyzer for any analyte the sample needs:
 * patient runs wait until a repeat QC passes. Returns the analyte name.
 */
export function qcHoldFor(db: LabDb, sampleId: string, equipmentId: string) {
  const analyteIds = new Set(
    itemsOfSample(db, sampleId)
      .filter(isItemLive)
      .flatMap((i) => i.analyteIds),
  )
  const event = Object.values(db.qcEvents).find(
    (e) =>
      e.equipmentId === equipmentId &&
      e.status !== 'resolved' &&
      analyteIds.has(e.analyteId),
  )
  return event ? (db.analytes[event.analyteId]?.name ?? event.analyteId) : null
}

/** Uses one container of the matching consumable for a collected sample. */
function consumeContainer(db: LabDb, sample: Sample, ctx: EngineCtx) {
  const item = Object.values(db.consumables).find(
    (c) => c.containerId === sample.container && c.quantity > 0,
  )
  if (!item) return
  item.quantity -= 1
  item.transactions.unshift({
    id: uid('txn'),
    at: ctx.now,
    by: ctx.by,
    type: 'consume',
    quantity: -1,
    balance: item.quantity,
    note: sample.accessionNo ?? undefined,
  })
}

function consumeReagents(
  db: LabDb,
  sample: Sample,
  equipmentId: string,
  ctx: EngineCtx,
) {
  const testIds = itemsOfSample(db, sample.id)
    .filter(isItemLive)
    .map((i) => i.testId)
  consumeReagentsFor(
    db,
    equipmentId,
    testIds,
    sample.accessionNo ?? undefined,
    ctx,
  )
}

export function startProcessing(
  db: LabDb,
  sampleId: string,
  input: { equipmentId?: string },
  ctx: EngineCtx,
) {
  const sample = must(db.samples, sampleId, 'sample')
  if (input.equipmentId) {
    const eq = must(db.equipment, input.equipmentId, 'equipment')
    if (eq.connection === 'offline')
      throw new LabApiError('analyzer-offline', { name: eq.name })
    if (eq.status === 'out-of-service' || eq.status === 'maintenance')
      throw new LabApiError('equipment-unavailable', { equipment: eq.name })
    const hold = qcHoldFor(db, sample.id, eq.id)
    if (hold) throw new LabApiError('qc-hold', { name: eq.name, test: hold })
  }
  transition(sample, 'processing')
  sample.processingStartedAt = ctx.now
  sample.processingBy = ctx.by
  sample.assignedTo ??= ctx.by
  if (input.equipmentId) {
    sample.equipmentId = input.equipmentId
    consumeReagents(db, sample, input.equipmentId, ctx)
  }
  sample.history.push(
    history(
      ctx,
      'processing-started',
      input.equipmentId
        ? { equipment: db.equipment[input.equipmentId]!.name }
        : undefined,
    ),
  )
  return sample
}

export function holdSample(
  db: LabDb,
  sampleId: string,
  input: { reason: HoldReason; remarks?: string },
  ctx: EngineCtx,
) {
  const sample = must(db.samples, sampleId, 'sample')
  const from = sample.status
  if (from !== 'received' && from !== 'processing')
    throw new LabApiError('invalid-transition', { from, to: 'on_hold' })
  if (!HOLD_REASONS.includes(input.reason))
    throw new LabApiError('validation-failed', { field: 'reason' })
  if (input.reason === 'other' && !input.remarks?.trim())
    throw new LabApiError('reason-required')
  transition(sample, 'on_hold')
  sample.holdFrom = from
  sample.heldAt = ctx.now
  sample.heldBy = ctx.by
  sample.holdReason = input.reason
  if (input.remarks) sample.holdRemarks = input.remarks
  else delete sample.holdRemarks
  sample.history.push(history(ctx, 'held', { reason: input.reason }))
  audit(db, ctx, 'sample', sample.id, 'held', {
    reason: input.remarks ? `${input.reason}: ${input.remarks}` : input.reason,
    detail: { accession: sample.accessionNo ?? '' },
  })
  return sample
}

export function resumeSample(db: LabDb, sampleId: string, ctx: EngineCtx) {
  const sample = must(db.samples, sampleId, 'sample')
  if (sample.status !== 'on_hold') throw new LabApiError('invalid-transition')
  transition(sample, sample.holdFrom ?? 'received')
  sample.history.push(history(ctx, 'resumed'))
  audit(db, ctx, 'sample', sample.id, 'resumed', {
    detail: { accession: sample.accessionNo ?? '' },
  })
  // Results authorised before the hold still complete the sample.
  completeSampleIfDone(db, sample.id, ctx)
  return sample
}

export interface RejectInput {
  reason: RejectionReason | CollectionFailureReason
  remarks?: string
  recollect: boolean
}

export function rejectSample(
  db: LabDb,
  sampleId: string,
  input: RejectInput,
  ctx: EngineCtx,
) {
  const sample = must(db.samples, sampleId, 'sample')
  const stage = sample.status === 'pending_collection' ? 'collection' : 'lab'
  const reasons: readonly string[] =
    stage === 'collection'
      ? [...COLLECTION_FAILURE_REASONS, ...REJECTION_REASONS]
      : REJECTION_REASONS
  if (!reasons.includes(input.reason))
    throw new LabApiError('validation-failed', { field: 'reason' })
  if (input.reason === 'other' && !input.remarks?.trim())
    throw new LabApiError('reason-required')
  transition(sample, 'rejected')
  sample.rejection = {
    stage,
    reason: input.reason,
    at: ctx.now,
    by: ctx.by,
    recollectionRequested: input.recollect,
    ...(input.remarks ? { remarks: input.remarks } : {}),
  }
  sample.history.push(history(ctx, 'rejected', { reason: input.reason }))
  const order = db.orders[sample.orderId]
  order?.history.push(
    history(ctx, 'rejection-recorded', {
      accession: sample.accessionNo ?? '',
      reason: input.reason,
    }),
  )
  audit(db, ctx, 'sample', sample.id, 'rejected', {
    reason: input.remarks?.trim()
      ? `${input.reason}: ${input.remarks.trim()}`
      : input.reason,
    detail: {
      accession: sample.accessionNo ?? '',
      recollect: input.recollect ? 'yes' : 'no',
    },
  })

  const items = itemsOfSample(db, sample.id).filter(
    (i) => isItemLive(i) && i.status !== 'validated',
  )
  // Results measured on a rejected sample are not usable; keep them as
  // revisions so nothing disappears silently.
  for (const item of items) {
    for (const result of resultsOfItem(db, item.id)) {
      if (result.value !== null) {
        result.revisions.push({
          value: result.value,
          flag: result.flag,
          at: result.updatedAt,
          by: result.updatedBy,
          reason: 'sample-rejected',
        })
        result.value = null
        result.flag = null
      }
    }
    for (const alert of Object.values(db.criticals)) {
      if (
        alert.orderItemId === item.id &&
        (alert.status === 'open' || alert.status === 'notified')
      ) {
        voidAlert(alert, 'sample-rejected', ctx)
      }
    }
    delete item.enteredAt
    delete item.enteredBy
  }

  const patient = db.patients[sample.patientId]
  const params = {
    accession: sample.accessionNo ?? '',
    patient: patient?.name ?? '',
    reason: input.reason,
  }

  let recollection: Sample | undefined
  if (input.recollect) {
    recollection = {
      id: uid('smp'),
      accessionNo: null,
      orderId: sample.orderId,
      patientId: sample.patientId,
      department: sample.department,
      container: sample.container,
      specimen: sample.specimen,
      volumeMl: sample.volumeMl,
      status: 'pending_collection',
      createdAt: ctx.now,
      labelPrintCount: 0,
      recollectionOfId: sample.id,
      history: [
        history(ctx, 'recollection-created', {
          from: sample.accessionNo ?? '',
        }),
      ],
    }
    db.samples[recollection.id] = recollection
    sample.recollectedById = recollection.id
    for (const item of items) {
      item.sampleId = recollection.id
      item.status = 'pending'
    }
    notify(
      db,
      ctx,
      'recollection-requested',
      'warning',
      params,
      '/laboratory/collection',
    )
  } else {
    for (const item of items) item.status = 'void'
  }
  notify(db, ctx, 'sample-rejected', 'danger', params, sampleLink(sample))
  logActivity(
    db,
    ctx,
    input.recollect ? 'sample-rejected-recollect' : 'sample-rejected',
    params,
    sampleLink(sample),
  )
  return { sample, recollection }
}

/** Assigns (or unassigns) the technician responsible for a sample. */
export function assignSample(
  db: LabDb,
  sampleId: string,
  staffId: string | null,
  ctx: EngineCtx,
) {
  const sample = must(db.samples, sampleId, 'sample')
  if (['rejected', 'discarded', 'completed'].includes(sample.status))
    throw new LabApiError('invalid-transition', { from: sample.status })
  if (staffId) {
    must(db.staff, staffId, 'staff')
    sample.assignedTo = staffId
  } else delete sample.assignedTo
  sample.history.push(
    history(ctx, 'assigned', { staff: staffId ? staffName(db, staffId) : '' }),
  )
  return sample
}
