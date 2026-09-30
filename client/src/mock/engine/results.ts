import { computeFlag, isAbnormal, isCriticalFlag } from '@/domain/flags'
import { uid } from '@/domain/ids'
import { pickRange, rangeSnapshot } from '@/domain/reference-ranges'
import type { Analyte, OrderItem, Result } from '@/domain/types'
import { isItemLive } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import {
  audit,
  history,
  itemsOfSample,
  LabApiError,
  logActivity,
  must,
  notify,
  patientAge,
  rangesOfAnalyte,
  resultsOfItem,
  type EngineCtx,
} from './core'

export interface ResultValueInput {
  value: string | null
  remarks?: string
}

export interface ItemResultsInput {
  itemId: string
  values: Record<string, ResultValueInput>
}

const EDITABLE: OrderItem['status'][] = [
  'pending',
  'draft',
  'returned',
  'entered',
]
/** Clinical authorisation. */
const VALIDATORS = ['pathologist', 'microbiologist']
/** Technical review (the second check in the lab). */
const REVIEWERS = ['technician', 'lab-manager', ...VALIDATORS]

/** Whether an analyte needs a value, given the other values in the same test. */
export function isAnalyteRequired(
  analyte: Analyte,
  values: Record<string, string | null | undefined>,
  analytes: Record<string, Analyte>,
) {
  if (!analyte.dependsOn) return true
  const parent = analytes[analyte.dependsOn]
  const parentValue = values[analyte.dependsOn]
  if (!parent || !parentValue) return false
  return isAbnormal(computeFlag(parent, parentValue, null))
}

function upsertResult(
  db: LabDb,
  item: OrderItem,
  analyte: Analyte,
  input: ResultValueInput,
  ctx: EngineCtx,
): Result {
  const existing = resultsOfItem(db, item.id).find(
    (r) => r.analyteId === analyte.id,
  )
  const patient = must(
    db.patients,
    db.orders[item.orderId]!.patientId,
    'patient',
  )
  const value = input.value?.trim() ? input.value.trim() : null
  const range =
    existing?.range ??
    rangeSnapshot(
      analyte,
      pickRange(rangesOfAnalyte(db, analyte.id), {
        sex: patient.sex,
        ageYears: patientAge(db, patient.id, ctx.now),
        specimen: item.specimen,
      }),
    )
  const flag = computeFlag(analyte, value, range)
  if (existing) {
    if (existing.value !== null && existing.value !== value) {
      existing.revisions.push({
        value: existing.value,
        flag: existing.flag,
        at: existing.updatedAt,
        by: existing.updatedBy,
      })
    }
    existing.value = value
    existing.flag = flag
    existing.updatedAt = ctx.now
    existing.updatedBy = ctx.by
    if (input.remarks?.trim()) existing.remarks = input.remarks.trim()
    else delete existing.remarks
    return existing
  }
  const result: Result = {
    id: uid('res'),
    orderItemId: item.id,
    analyteId: analyte.id,
    value,
    flag,
    unit: analyte.unit,
    range,
    updatedAt: ctx.now,
    updatedBy: ctx.by,
    revisions: [],
  }
  if (input.remarks?.trim()) result.remarks = input.remarks.trim()
  db.results[result.id] = result
  return result
}

/** Opens a critical alert for a critical value, or voids one that no longer applies. */
export function syncCriticalAlert(
  db: LabDb,
  result: Result,
  item: OrderItem,
  ctx: EngineCtx,
) {
  const analyte = db.analytes[result.analyteId]
  if (!analyte) return
  const critical = isCriticalFlag(analyte, result.flag)
  const alerts = Object.values(db.criticals).filter(
    (a) => a.resultId === result.id && a.status !== 'voided',
  )
  const current = alerts.find((a) => a.value === result.value)
  for (const alert of alerts) {
    if (alert === current && critical) continue
    if (alert.status === 'acknowledged' && alert.value === result.value)
      continue
    if (alert.status === 'open' || alert.status === 'notified') {
      alert.status = 'voided'
      alert.voidedAt = ctx.now
      alert.voidReason = critical ? 'value-revised' : 'no-longer-critical'
      alert.history.push(
        history(ctx, 'critical-voided', { reason: alert.voidReason }),
      )
    }
  }
  if (!critical || current || !result.value || !result.flag) return
  const order = must(db.orders, item.orderId, 'order')
  const patient = must(db.patients, order.patientId, 'patient')
  const alert = {
    id: uid('crit'),
    resultId: result.id,
    orderItemId: item.id,
    orderId: order.id,
    sampleId: item.sampleId ?? '',
    patientId: patient.id,
    analyteId: analyte.id,
    value: result.value,
    flag: result.flag,
    status: 'open' as const,
    detectedAt: ctx.now,
    detectedBy: ctx.by,
    attempts: [],
    history: [history(ctx, 'critical-detected')],
  }
  db.criticals[alert.id] = alert
  audit(db, ctx, 'critical', alert.id, 'detected', {
    detail: {
      analyte: analyte.name,
      value: `${result.value} ${result.unit}`.trim(),
    },
  })
  const params = {
    patient: patient.name,
    analyte: analyte.name,
    value: `${result.value} ${result.unit}`.trim(),
  }
  notify(
    db,
    ctx,
    'critical-detected',
    'danger',
    params,
    `/laboratory/critical-values?alert=${alert.id}`,
  )
  logActivity(
    db,
    ctx,
    'critical-detected',
    params,
    `/laboratory/critical-values?alert=${alert.id}`,
  )
}

export function saveResults(
  db: LabDb,
  sampleId: string,
  entries: ItemResultsInput[],
  submit: boolean,
  ctx: EngineCtx,
) {
  const sample = must(db.samples, sampleId, 'sample')
  if (!['received', 'processing'].includes(sample.status))
    throw new LabApiError('sample-not-in-lab', {
      accession: sample.accessionNo ?? '',
    })
  if (sample.status === 'received') {
    sample.status = 'processing'
    sample.processingStartedAt = ctx.now
    sample.processingBy = ctx.by
    sample.history.push(history(ctx, 'processing-started'))
  }

  const touched: OrderItem[] = []
  for (const entry of entries) {
    const item = must(db.items, entry.itemId, 'item')
    if (item.sampleId !== sampleId || !isItemLive(item))
      throw new LabApiError('invalid-transition')
    if (!EDITABLE.includes(item.status))
      throw new LabApiError('item-already-validated')

    const values: Record<string, string | null> = {}
    for (const analyteId of item.analyteIds)
      values[analyteId] = entry.values[analyteId]?.value ?? null

    if (submit) {
      const missing = item.analyteIds.filter((id) => {
        const analyte = db.analytes[id]
        return (
          analyte &&
          isAnalyteRequired(analyte, values, db.analytes) &&
          !values[id]?.trim()
        )
      })
      if (missing.length > 0)
        throw new LabApiError('results-incomplete', {
          test: item.testName,
          count: missing.length,
        })
    }

    for (const analyteId of item.analyteIds) {
      const analyte = must(db.analytes, analyteId, 'analyte')
      const input = entry.values[analyteId]
      if (!input) continue
      const result = upsertResult(db, item, analyte, input, ctx)
      if (submit) syncCriticalAlert(db, result, item, ctx)
    }

    if (submit) {
      item.status = 'entered'
      item.enteredAt = ctx.now
      item.enteredBy = ctx.by
      delete item.returnedReason
    } else if (item.status === 'pending' || item.status === 'returned') {
      item.status = 'draft'
    }
    touched.push(item)
  }

  sample.history.push(
    history(ctx, submit ? 'results-entered' : 'results-drafted', {
      tests: touched.map((i) => i.testName).join(', '),
    }),
  )
  if (submit) {
    const patient = db.patients[sample.patientId]
    logActivity(
      db,
      ctx,
      'results-entered',
      {
        accession: sample.accessionNo ?? '',
        patient: patient?.name ?? '',
        tests: touched.length,
      },
      `/laboratory/validation`,
    )
  }
  return touched
}

function staffWithRole(
  db: LabDb,
  ctx: EngineCtx,
  roles: string[],
  code: 'not-authorized-validator' | 'not-authorized-reviewer',
) {
  const staff = db.staff[ctx.by]
  if (!staff || !roles.includes(staff.role))
    throw new LabApiError(code, { name: staff?.name ?? ctx.by })
  return staff
}

function ensureNotOnHold(db: LabDb, item: OrderItem) {
  const sample = item.sampleId ? db.samples[item.sampleId] : undefined
  if (sample?.status === 'on_hold')
    throw new LabApiError('sample-on-hold', {
      accession: sample.accessionNo ?? '',
    })
  return sample
}

function completeSampleIfDone(
  db: LabDb,
  sampleId: string | null,
  ctx: EngineCtx,
) {
  if (!sampleId) return
  const sample = db.samples[sampleId]
  if (!sample || sample.status !== 'processing') return
  const live = itemsOfSample(db, sampleId).filter(isItemLive)
  if (live.length > 0 && live.every((i) => i.status === 'validated')) {
    sample.status = 'completed'
    sample.completedAt = ctx.now
    sample.history.push(history(ctx, 'completed'))
  }
}

/** Resuming a sample whose results were all validated completes it. */
export { completeSampleIfDone }

/**
 * Technical review: a second person in the lab checks the entered values,
 * flags and QC before a pathologist authorises them.
 */
export function reviewItems(db: LabDb, itemIds: string[], ctx: EngineCtx) {
  const staff = staffWithRole(db, ctx, REVIEWERS, 'not-authorized-reviewer')
  const reviewed: OrderItem[] = []
  for (const id of itemIds) {
    const item = must(db.items, id, 'item')
    if (
      !isItemLive(item) ||
      (item.status !== 'entered' && item.status !== 'held')
    )
      throw new LabApiError('invalid-transition', {
        from: item.status,
        to: 'reviewed',
      })
    const sample = ensureNotOnHold(db, item)
    if (
      db.settings.requireIndependentReview &&
      item.enteredBy === ctx.by &&
      !VALIDATORS.includes(staff.role)
    )
      throw new LabApiError('self-review-not-allowed')
    item.status = 'reviewed'
    item.reviewedAt = ctx.now
    item.reviewedBy = ctx.by
    delete item.heldReason
    reviewed.push(item)
    sample?.history.push(history(ctx, 'reviewed', { test: item.testName }))
    audit(db, ctx, 'result', item.id, 'reviewed', {
      detail: { test: item.testName },
    })
  }
  if (reviewed.length > 0)
    logActivity(
      db,
      ctx,
      'results-reviewed',
      { count: reviewed.length },
      '/laboratory/validation?stage=authorise',
    )
  return reviewed
}

/**
 * Clinical authorisation by a pathologist or microbiologist. Results must be
 * reviewed first; a validator may review and authorise in one step, which is
 * recorded as both.
 */
export function validateItems(db: LabDb, itemIds: string[], ctx: EngineCtx) {
  staffWithRole(db, ctx, VALIDATORS, 'not-authorized-validator')
  const validated: OrderItem[] = []
  for (const id of itemIds) {
    const item = must(db.items, id, 'item')
    if (
      !isItemLive(item) ||
      !['entered', 'held', 'reviewed'].includes(item.status)
    )
      throw new LabApiError('invalid-transition', {
        from: item.status,
        to: 'validated',
      })
    const sample = ensureNotOnHold(db, item)
    if (item.status !== 'reviewed') {
      if (db.settings.requireIndependentReview && item.enteredBy === ctx.by)
        throw new LabApiError('not-reviewed', { test: item.testName })
      item.reviewedAt = ctx.now
      item.reviewedBy = ctx.by
      sample?.history.push(history(ctx, 'reviewed', { test: item.testName }))
    }
    item.status = 'validated'
    item.validatedAt = ctx.now
    item.validatedBy = ctx.by
    delete item.heldReason
    validated.push(item)
    sample?.history.push(history(ctx, 'validated', { test: item.testName }))
    audit(db, ctx, 'result', item.id, 'validated', {
      detail: { test: item.testName },
    })
  }
  for (const item of validated) completeSampleIfDone(db, item.sampleId, ctx)
  if (validated.length > 0)
    logActivity(
      db,
      ctx,
      'results-validated',
      { count: validated.length },
      '/laboratory/reports',
    )
  return validated
}

export function returnItem(
  db: LabDb,
  itemId: string,
  reason: string,
  ctx: EngineCtx,
) {
  staffWithRole(db, ctx, REVIEWERS, 'not-authorized-reviewer')
  const item = must(db.items, itemId, 'item')
  if (!reason.trim()) throw new LabApiError('reason-required')
  if (
    !isItemLive(item) ||
    !['entered', 'held', 'reviewed'].includes(item.status)
  )
    throw new LabApiError('invalid-transition', {
      from: item.status,
      to: 'returned',
    })
  item.status = 'returned'
  item.returnedReason = reason
  delete item.heldReason
  delete item.reviewedAt
  delete item.reviewedBy
  const sample = item.sampleId ? db.samples[item.sampleId] : undefined
  sample?.history.push(
    history(ctx, 'returned', { test: item.testName, reason }),
  )
  audit(db, ctx, 'result', item.id, 'returned', {
    reason,
    detail: { test: item.testName },
  })
  const patient = db.patients[db.orders[item.orderId]?.patientId ?? '']
  notify(
    db,
    ctx,
    'result-returned',
    'warning',
    { test: item.testName, patient: patient?.name ?? '', reason },
    sample ? `/laboratory/results/${sample.id}` : '/laboratory/results',
  )
  return item
}

export function holdItem(
  db: LabDb,
  itemId: string,
  reason: string,
  ctx: EngineCtx,
) {
  staffWithRole(db, ctx, REVIEWERS, 'not-authorized-reviewer')
  const item = must(db.items, itemId, 'item')
  if (!reason.trim()) throw new LabApiError('reason-required')
  if (!isItemLive(item) || !['entered', 'reviewed'].includes(item.status))
    throw new LabApiError('invalid-transition', {
      from: item.status,
      to: 'held',
    })
  item.status = 'held'
  item.heldReason = reason
  delete item.reviewedAt
  delete item.reviewedBy
  const sample = item.sampleId ? db.samples[item.sampleId] : undefined
  sample?.history.push(
    history(ctx, 'item-held', { test: item.testName, reason }),
  )
  audit(db, ctx, 'result', item.id, 'held', {
    reason,
    detail: { test: item.testName },
  })
  return item
}

export function addItemComment(
  db: LabDb,
  itemId: string,
  input: { text: string; visibility: 'internal' | 'report' },
  ctx: EngineCtx,
) {
  const item = must(db.items, itemId, 'item')
  const text = input.text.trim()
  if (!text) throw new LabApiError('validation-failed', { field: 'text' })
  item.comments.push({
    id: uid('cmt'),
    at: ctx.now,
    by: ctx.by,
    text,
    visibility: input.visibility,
  })
  return item
}
