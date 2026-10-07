import { accessionPrefix, nextSequence, uid } from '@/domain/ids'
import {
  COLLECTION_FAILURE_REASONS,
  FASTING_STATUSES,
  HOLD_REASONS,
  IDENTITY_METHODS,
  RECEIPT_TEMPERATURES,
  REJECTION_REASONS,
  SEND_OUT_STATES,
  type CollectionFailureReason,
  type CollectionSite,
  type FastingStatus,
  type HoldReason,
  type IdentityMethod,
  type ReceiptTemperature,
  type RejectionReason,
  type Sample,
  type SendOutState,
  type StorageCondition,
} from '@/domain/types'
import { canTransitionSample, isItemLive } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import { voidAlert } from './critical'
import { consumeReagentsFor } from './inventory'
import { completeSampleIfDone } from './results'
import { qcHoldFor } from './qc-gate'
import { testsMissingConsent } from './consent'

export { qcHoldFor }
import {
  audit,
  history,
  itemsOfSample,
  LabApiError,
  logActivity,
  must,
  notify,
  requirePermission,
  resultsOfItem,
  staffName,
  type EngineCtx,
} from './core'

/** How far a recorded collection time may differ from now without a reason. */
const UNEXPLAINED_TIME_MS = 10 * 60_000

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

const sampleLink = (s: Sample) => `/specimens/${s.id}`

export function printLabel(db: LabDb, sampleId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'label.print')
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
  /** When the specimen was drawn; defaults to now in the UI. */
  collectedAt: number
  site: CollectionSite
  remarks?: string
  /** Why the collection time differs from now, when it does. */
  timeReason?: string
  /** How the patient was identified (two identifiers, NABL 112A 6(h)). */
  identity: IdentityMethod
  /** Required when any test on the specimen needs fasting. */
  fasting?: FastingStatus
}

export function collectSample(
  db: LabDb,
  sampleId: string,
  input: CollectInput,
  ctx: EngineCtx,
) {
  // The collector is the person recording the collection.
  requirePermission(db, ctx, 'specimen.collect')
  const sample = must(db.samples, sampleId, 'sample')
  const order = must(db.orders, sample.orderId, 'order')
  if (input.collectedAt > ctx.now)
    throw new LabApiError('collection-in-future', { now: `time:${ctx.now}` })
  if (order.orderedAt && input.collectedAt < order.orderedAt)
    throw new LabApiError('collection-before-order', {
      time: `time:${order.orderedAt}`,
    })
  const timeReason = input.timeReason?.trim()
  if (ctx.now - input.collectedAt > UNEXPLAINED_TIME_MS && !timeReason)
    throw new LabApiError('collection-time-reason')
  if (!IDENTITY_METHODS.includes(input.identity))
    throw new LabApiError('identity-not-confirmed')
  const items = itemsOfSample(db, sample.id).filter(isItemLive)
  const needsFasting = items.some((i) => db.tests[i.testId]?.fasting)
  if (
    needsFasting &&
    (!input.fasting || !FASTING_STATUSES.includes(input.fasting))
  )
    throw new LabApiError('fasting-status-required')
  const missing = testsMissingConsent(db, items)
  if (missing.length)
    throw new LabApiError('consent-required', {
      tests: missing.map((i) => i.testName).join(', '),
    })
  // A deliberately deferred collection (e.g. post-prandial) taken early
  // needs a reason.
  if (
    sample.scheduledFor !== undefined &&
    input.collectedAt < sample.scheduledFor &&
    !timeReason
  )
    throw new LabApiError('collection-scheduled', {
      time: `time:${sample.scheduledFor}`,
    })
  transition(sample, 'collected')
  ensureAccession(db, sample, ctx)
  consumeContainer(db, sample, ctx)
  sample.collectedAt = input.collectedAt
  sample.collectedBy = ctx.by
  sample.collectionSite = input.site
  sample.identityCheck = { method: input.identity, at: ctx.now, by: ctx.by }
  if (input.fasting) sample.fastingStatus = input.fasting
  if (input.remarks) sample.collectionRemarks = input.remarks
  sample.history.push({ ...history(ctx, 'collected'), at: input.collectedAt })
  audit(db, ctx, 'sample', sample.id, 'collected', {
    from: 'pending_collection',
    to: 'collected',
    ...(timeReason ? { reason: timeReason } : {}),
    detail: { accession: sample.accessionNo! },
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

/**
 * Receives a sample in the lab by accession number (scanned) or id. The
 * receiver confirms it is acceptable; an unacceptable one is rejected
 * instead, with a reason.
 */
export function receiveSample(
  db: LabDb,
  ref: string,
  ctx: EngineCtx,
  input: { note?: string; temperature?: ReceiptTemperature } = {},
) {
  requirePermission(db, ctx, 'specimen.receive')
  if (
    input.temperature !== undefined &&
    !RECEIPT_TEMPERATURES.includes(input.temperature)
  )
    throw new LabApiError('validation-failed', { field: 'temperature' })
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
  if (sample.collectedAt !== undefined && ctx.now < sample.collectedAt)
    throw new LabApiError('received-before-collected', {
      time: `time:${sample.collectedAt}`,
    })
  transition(sample, 'received')
  sample.receivedAt = ctx.now
  sample.receivedBy = ctx.by
  sample.receiptCondition = 'acceptable'
  if (input.note?.trim()) sample.receiptNote = input.note.trim()
  if (input.temperature) {
    sample.receiptTemperature = input.temperature
    const storage = itemsOfSample(db, sample.id)
      .filter(isItemLive)
      .map((i) => db.tests[i.testId]?.storage)
      .filter((x): x is StorageCondition => x !== undefined)
    if (!temperatureFits(input.temperature, storage))
      sample.temperatureDeviation = true
  }
  sample.history.push(history(ctx, 'received'))
  audit(db, ctx, 'sample', sample.id, 'received', {
    from: 'collected',
    to: 'received',
    detail: {
      accession: sample.accessionNo ?? '',
      ...(sample.receiptTemperature
        ? { temperature: sample.receiptTemperature }
        : {}),
      ...(sample.temperatureDeviation ? { deviation: 'yes' } : {}),
    },
  })
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
  requirePermission(db, ctx, 'specimen.process')
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
  audit(db, ctx, 'sample', sample.id, 'processing-started', {
    from: 'received',
    to: 'processing',
    detail: {
      accession: sample.accessionNo ?? '',
      equipment: input.equipmentId
        ? db.equipment[input.equipmentId]!.name
        : 'manual',
    },
  })
  return sample
}

export function holdSample(
  db: LabDb,
  sampleId: string,
  input: { reason: HoldReason; remarks?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'specimen.process')
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
    from,
    to: 'on_hold',
    detail: { accession: sample.accessionNo ?? '' },
  })
  return sample
}

export function resumeSample(db: LabDb, sampleId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'specimen.process')
  const sample = must(db.samples, sampleId, 'sample')
  if (sample.status !== 'on_hold') throw new LabApiError('invalid-transition')
  transition(sample, sample.holdFrom ?? 'received')
  sample.history.push(history(ctx, 'resumed'))
  audit(db, ctx, 'sample', sample.id, 'resumed', {
    from: 'on_hold',
    to: sample.status,
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
  // "Unable to collect" belongs to collection staff; rejecting a specimen
  // that reached the lab belongs to the bench.
  requirePermission(
    db,
    ctx,
    stage === 'collection' ? 'specimen.collect' : 'specimen.reject',
  )
  const fromStatus = sample.status
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
    from: fromStatus,
    to: 'rejected',
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
    notify(db, ctx, 'recollection-requested', 'warning', params, '/collection')
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
  // Picking up work yourself is part of the bench; giving it to someone
  // else is the lab manager's.
  requirePermission(
    db,
    ctx,
    staffId === ctx.by ? 'specimen.process' : 'work.assign',
  )
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
  audit(db, ctx, 'sample', sample.id, 'assigned', {
    to: staffId ? staffName(db, staffId) : '',
    detail: { accession: sample.accessionNo ?? '' },
  })
  return sample
}

/**
 * Whether a specimen arrived at a temperature its tests allow: frozen
 * storage needs frozen transport, refrigerated needs chilled (or colder),
 * room temperature accepts ambient or chilled.
 */
export function temperatureFits(
  temperature: ReceiptTemperature,
  storage: StorageCondition[],
) {
  if (temperature === 'out-of-range') return false
  return storage.every((need) =>
    need === 'frozen'
      ? temperature === 'frozen'
      : need === 'refrigerated' || need === 'dark-refrigerated'
        ? temperature === 'chilled' || temperature === 'frozen'
        : temperature !== 'frozen',
  )
}

/**
 * Defers a collection to a later time, e.g. a post-prandial sugar two
 * hours after the meal. Taking it earlier then needs a reason.
 */
export function scheduleCollection(
  db: LabDb,
  sampleId: string,
  input: { at: number; reason: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'specimen.collect')
  const sample = must(db.samples, sampleId, 'sample')
  if (sample.status !== 'pending_collection')
    throw new LabApiError('invalid-transition', {
      from: sample.status,
      to: 'scheduled',
    })
  const reason = input.reason.trim()
  if (!reason) throw new LabApiError('reason-required')
  if (input.at <= ctx.now)
    throw new LabApiError('validation-failed', { field: 'time' })
  sample.scheduledFor = input.at
  sample.scheduleReason = reason
  sample.history.push(history(ctx, 'collection-scheduled'))
  audit(db, ctx, 'sample', sample.id, 'collection-scheduled', {
    reason,
    to: `time:${input.at}`,
  })
  return sample
}

/**
 * Splits a received specimen into aliquots (child specimens with their own
 * accession numbers, -01, -02, ...), moving the listed tests to each. At
 * least one test stays on the original. Results not yet started only.
 */
export function splitSample(
  db: LabDb,
  sampleId: string,
  groups: string[][],
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'specimen.split')
  const parent = must(db.samples, sampleId, 'sample')
  if (parent.status !== 'received' && parent.status !== 'processing')
    throw new LabApiError('cannot-split', { reason: 'status' })
  if (parent.parentId)
    throw new LabApiError('cannot-split', { reason: 'aliquot' })
  const live = itemsOfSample(db, parent.id).filter(isItemLive)
  const movable = new Set(
    live
      .filter((i) => i.status === 'pending' || i.status === 'draft')
      .map((i) => i.id),
  )
  const moving = groups.flat()
  if (
    groups.length === 0 ||
    groups.some((g) => g.length === 0) ||
    new Set(moving).size !== moving.length ||
    moving.some((id) => !movable.has(id))
  )
    throw new LabApiError('cannot-split', { reason: 'tests' })
  if (moving.length >= live.length)
    throw new LabApiError('cannot-split', { reason: 'keep-one' })
  const existing = Object.values(db.samples).filter(
    (s) => s.parentId === parent.id,
  ).length
  const children = groups.map((group, i) => {
    const aliquotNo = existing + i + 1
    const child: Sample = {
      id: uid('smp'),
      accessionNo: `${parent.accessionNo}-${String(aliquotNo).padStart(2, '0')}`,
      orderId: parent.orderId,
      patientId: parent.patientId,
      department: db.items[group[0]!]!.department,
      container: parent.container,
      specimen: parent.specimen,
      volumeMl: null,
      status: 'received',
      createdAt: ctx.now,
      labelPrintCount: 0,
      ...(parent.collectedAt !== undefined
        ? { collectedAt: parent.collectedAt }
        : {}),
      ...(parent.collectedBy ? { collectedBy: parent.collectedBy } : {}),
      receivedAt: ctx.now,
      receivedBy: ctx.by,
      receiptCondition: 'acceptable',
      parentId: parent.id,
      aliquotNo,
      history: [
        history(ctx, 'aliquoted', { parent: parent.accessionNo ?? '' }),
      ],
    }
    db.samples[child.id] = child
    for (const id of group) db.items[id]!.sampleId = child.id
    return child
  })
  parent.history.push(
    history(ctx, 'split', {
      aliquots: children.map((c) => c.accessionNo).join(', '),
    }),
  )
  audit(db, ctx, 'sample', parent.id, 'split', {
    detail: {
      accession: parent.accessionNo ?? '',
      aliquots: children.map((c) => c.accessionNo).join(', '),
    },
  })
  return children
}

/**
 * Refers a received specimen to an outside laboratory. Its tests are then
 * performed (and reported as performed) by that lab; results come back and
 * are entered from its report.
 */
export function sendOutSample(
  db: LabDb,
  sampleId: string,
  input: { labId: string; courier?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'specimen.send-out')
  const sample = must(db.samples, sampleId, 'sample')
  const lab = must(db.referralLabs, input.labId, 'referral-lab')
  if (!lab.active) throw new LabApiError('send-out-state')
  if (sample.status !== 'received' || sample.sendOut)
    throw new LabApiError('send-out-state')
  transition(sample, 'processing')
  sample.processingStartedAt = ctx.now
  sample.processingBy = ctx.by
  sample.sendOut = {
    labId: lab.id,
    state: 'dispatched',
    dispatchedAt: ctx.now,
    dispatchedBy: ctx.by,
    ...(input.courier?.trim() ? { courier: input.courier.trim() } : {}),
  }
  for (const item of itemsOfSample(db, sample.id).filter(isItemLive))
    item.performedBy = {
      labId: lab.id,
      name: lab.name,
      city: lab.city,
      nablAccredited: lab.nablAccredited,
      ...(lab.certificateNo ? { certificateNo: lab.certificateNo } : {}),
    }
  sample.history.push(history(ctx, 'sent-out', { lab: lab.name }))
  audit(db, ctx, 'sample', sample.id, 'sent-out', {
    to: lab.name,
    detail: { accession: sample.accessionNo ?? '' },
  })
  return sample
}

const SEND_OUT_ORDER: SendOutState[] = [...SEND_OUT_STATES]

/** Tracks a referred specimen forward: at the referral lab, result back. */
export function updateSendOut(
  db: LabDb,
  sampleId: string,
  input: { state: SendOutState; externalRef?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'specimen.send-out')
  const sample = must(db.samples, sampleId, 'sample')
  const sendOut = sample.sendOut
  if (
    !sendOut ||
    SEND_OUT_ORDER.indexOf(input.state) <= SEND_OUT_ORDER.indexOf(sendOut.state)
  )
    throw new LabApiError('send-out-state')
  const from = sendOut.state
  sendOut.state = input.state
  if (input.state === 'received') sendOut.receivedAt = ctx.now
  if (input.state === 'resulted') sendOut.resultedAt = ctx.now
  if (input.externalRef?.trim()) sendOut.externalRef = input.externalRef.trim()
  audit(db, ctx, 'sample', sample.id, 'send-out-updated', {
    from,
    to: input.state,
    detail: { accession: sample.accessionNo ?? '' },
  })
  return sample
}
