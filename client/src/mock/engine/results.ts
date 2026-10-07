import { computeFlag, isCriticalFlag, parseNumeric } from '@/domain/flags'
import { computeCalculated } from '@/domain/calculated'
import { isAnalyteRequired } from '@/domain/flags'
import {
  canAuthoriseDepartment,
  isRegisteredSignatory,
} from '@/domain/permissions'
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
  requirePermission,
  resultsOfItem,
  type EngineCtx,
} from './core'
import { qcHoldFor } from './qc-gate'
import { applyAutoCheck } from './autoverify'

export interface ResultValueInput {
  value: string | null
  remarks?: string
}

export interface ItemResultsInput {
  itemId: string
  values: Record<string, ResultValueInput>
  /** Why a submitted value is being changed; required when one is. */
  changeReason?: string
}

const EDITABLE: OrderItem['status'][] = [
  'pending',
  'draft',
  'returned',
  'entered',
]
/** Signatories, who may verify and authorise in one action. */
const VALIDATORS = ['pathologist', 'microbiologist']

/**
 * Refuses a value the analyte cannot have: text where a number is needed, or
 * a number outside the physiologically possible limits (a typing or unit
 * error). Values like "<0.5" and ">1000" are accepted.
 */
function checkPlausible(analyte: Analyte, value: string | null) {
  if (value === null || analyte.resultType !== 'numeric') return
  const parsed = parseNumeric(value)
  if (!parsed) throw new LabApiError('not-numeric', { analyte: analyte.name })
  const low = analyte.plausibleLow
  const high = analyte.plausibleHigh
  if (
    (low !== undefined && parsed.value < low) ||
    (high !== undefined && parsed.value > high)
  )
    throw new LabApiError('implausible-value', {
      analyte: analyte.name,
      value,
      unit: analyte.unit,
      low: low ?? '',
      high: high ?? '',
    })
}

function upsertResult(
  db: LabDb,
  item: OrderItem,
  analyte: Analyte,
  input: ResultValueInput,
  ctx: EngineCtx,
  changeReason?: string,
): Result {
  const existing = resultsOfItem(db, item.id).find(
    (r) => r.analyteId === analyte.id,
  )
  const sample = item.sampleId ? db.samples[item.sampleId] : undefined
  const source = sample?.equipmentId ?? 'manual'
  const patient = must(
    db.patients,
    db.orders[item.orderId]!.patientId,
    'patient',
  )
  const value = input.value?.trim() ? input.value.trim() : null
  checkPlausible(analyte, value)
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
        ...(changeReason ? { reason: changeReason } : {}),
      })
    }
    existing.value = value
    existing.flag = flag
    existing.updatedAt = ctx.now
    existing.updatedBy = ctx.by
    existing.source = source
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
    source,
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
    `/critical-results?alert=${alert.id}`,
  )
  logActivity(
    db,
    ctx,
    'critical-detected',
    params,
    `/critical-results?alert=${alert.id}`,
  )
}

export function saveResults(
  db: LabDb,
  sampleId: string,
  entries: ItemResultsInput[],
  submit: boolean,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'result.enter')
  const sample = must(db.samples, sampleId, 'sample')
  // Results need a specimen in the lab: never collected, rejected,
  // discarded or on-hold specimens are refused (audit D2, D8).
  if (!['received', 'processing'].includes(sample.status))
    throw new LabApiError('sample-not-in-lab', {
      accession: sample.accessionNo ?? '',
    })
  if (sample.status === 'received') {
    // Entering results for a received specimen starts manual processing.
    sample.status = 'processing'
    sample.processingStartedAt = ctx.now
    sample.processingBy = ctx.by
    sample.history.push(history(ctx, 'processing-started'))
    audit(db, ctx, 'sample', sample.id, 'processing-started', {
      from: 'received',
      to: 'processing',
      detail: { accession: sample.accessionNo ?? '', equipment: 'manual' },
    })
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
    // Calculated analytes come from the measured values, never from what
    // was typed (domain/calculated.ts).
    const computed = computeCalculated(
      item.analyteIds,
      values,
      (id) => db.analytes[id]?.decimals ?? 0,
    )
    const inputs: Record<string, ResultValueInput> = { ...entry.values }
    for (const [id, c] of Object.entries(computed)) {
      values[id] = c.value
      inputs[id] = { ...entry.values[id], value: c.value }
    }

    // A submitted value is a result on record: changing it needs a reason.
    const changeReason = entry.changeReason?.trim()
    if (item.status === 'entered' && !changeReason) {
      const changed = resultsOfItem(db, item.id).some(
        (r) =>
          r.value !== null &&
          entry.values[r.analyteId] !== undefined &&
          (entry.values[r.analyteId]!.value?.trim() || null) !== r.value,
      )
      if (changed) throw new LabApiError('reason-required')
    }

    if (submit) {
      const missing = item.analyteIds.filter((id) => {
        const analyte = db.analytes[id]
        return (
          analyte &&
          !(id in computed) &&
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
      const input = inputs[analyteId]
      if (!input) continue
      const before = resultsOfItem(db, item.id).find(
        (r) => r.analyteId === analyteId,
      )?.value
      const result = upsertResult(db, item, analyte, input, ctx, changeReason)
      if (analyteId in computed) result.calculated = true
      if (item.status === 'entered' && before && before !== result.value)
        audit(db, ctx, 'result', item.id, 'value-changed', {
          from: before,
          to: result.value ?? '',
          ...(changeReason ? { reason: changeReason } : {}),
          detail: { test: item.testName, analyte: analyte.name },
        })
      if (submit) syncCriticalAlert(db, result, item, ctx)
    }

    if (submit) {
      const from = item.status
      item.status = 'entered'
      item.enteredAt = ctx.now
      item.enteredBy = ctx.by
      delete item.returnedReason
      if (from !== 'entered')
        audit(db, ctx, 'result', item.id, 'resulted', {
          from,
          to: 'entered',
          detail: { test: item.testName },
        })
      applyAutoCheck(db, item, ctx)
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
      `/verification`,
    )
  }
  return touched
}

/** Results measured on an analyzer with an open QC failure stay unreleased. */
function ensureQcPassed(db: LabDb, item: OrderItem) {
  const sample = item.sampleId ? db.samples[item.sampleId] : undefined
  if (!sample?.equipmentId) return
  const failed = qcHoldFor(db, sample.id, sample.equipmentId)
  if (failed)
    throw new LabApiError('qc-hold', {
      name: db.equipment[sample.equipmentId]?.name ?? '',
      test: failed,
    })
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
  const staff = requirePermission(db, ctx, 'result.verify')
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
      from: 'entered',
      to: 'reviewed',
      detail: { test: item.testName },
    })
  }
  if (reviewed.length > 0)
    logActivity(
      db,
      ctx,
      'results-reviewed',
      { count: reviewed.length },
      '/verification?stage=authorise',
    )
  return reviewed
}

/**
 * Clinical authorisation by a pathologist or microbiologist. Results must be
 * reviewed first; a validator may review and authorise in one step, which is
 * recorded as both.
 */
export function validateItems(db: LabDb, itemIds: string[], ctx: EngineCtx) {
  const staff = requirePermission(db, ctx, 'result.authorise')
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
    if (!canAuthoriseDepartment(staff, item.department))
      throw new LabApiError('outside-discipline', {
        name: staff.name,
        department: `enum:department.${staff.department ?? 'microbiology'}`,
        test: item.testName,
      })
    if (!isRegisteredSignatory(staff, item.department, ctx.now))
      throw new LabApiError('not-a-signatory', {
        name: staff.name,
        department: `enum:department.${item.department}`,
      })
    const sample = ensureNotOnHold(db, item)
    ensureQcPassed(db, item)
    const from = item.status
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
      from,
      to: 'validated',
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
      '/reports',
    )
  return validated
}

export function returnItem(
  db: LabDb,
  itemId: string,
  reason: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'result.verify')
  const item = must(db.items, itemId, 'item')
  if (!reason.trim()) throw new LabApiError('reason-required')
  const fromStatus = item.status
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
    from: fromStatus,
    to: 'returned',
    detail: { test: item.testName },
  })
  const patient = db.patients[db.orders[item.orderId]?.patientId ?? '']
  notify(
    db,
    ctx,
    'result-returned',
    'warning',
    { test: item.testName, patient: patient?.name ?? '', reason },
    sample ? `/results/${sample.id}` : '/worklists',
  )
  return item
}

export function holdItem(
  db: LabDb,
  itemId: string,
  reason: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'result.verify')
  const item = must(db.items, itemId, 'item')
  if (!reason.trim()) throw new LabApiError('reason-required')
  const fromStatus = item.status
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
    from: fromStatus,
    to: 'held',
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
  requirePermission(db, ctx, 'result.comment')
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

/**
 * Reruns a test on the same specimen (repeat, or after dilution). The first
 * values stay on record, marked as replaced by the rerun, and the test goes
 * back to result entry. Verification then shows both.
 */
export function requestRerun(
  db: LabDb,
  itemId: string,
  input: { reason: string; dilution?: number },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'result.rerun')
  const item = must(db.items, itemId, 'item')
  const reason = input.reason.trim()
  if (!reason) throw new LabApiError('reason-required')
  if (
    !isItemLive(item) ||
    !['entered', 'reviewed', 'held', 'returned'].includes(item.status)
  )
    throw new LabApiError('invalid-transition', {
      from: item.status,
      to: 'rerun',
    })
  const { dilution } = input
  if (
    dilution !== undefined &&
    !(Number.isFinite(dilution) && dilution > 1 && dilution <= 1000)
  )
    throw new LabApiError('validation-failed', { field: 'dilution' })
  const sample = ensureNotOnHold(db, item)
  const from = item.status
  for (const result of resultsOfItem(db, item.id)) {
    if (result.value === null) continue
    result.revisions.push({
      value: result.value,
      flag: result.flag,
      at: result.updatedAt,
      by: result.updatedBy,
      reason,
      rerun: true,
      ...(result.dilution ? { dilution: result.dilution } : {}),
    })
    result.value = null
    result.flag = null
    if (dilution) result.dilution = dilution
    else delete result.dilution
  }
  item.status = 'draft'
  item.rerunCount = (item.rerunCount ?? 0) + 1
  delete item.reviewedAt
  delete item.reviewedBy
  delete item.returnedReason
  delete item.heldReason
  sample?.history.push(
    history(ctx, 'rerun-requested', { test: item.testName, reason }),
  )
  audit(db, ctx, 'result', item.id, 'rerun-requested', {
    reason,
    from,
    to: 'draft',
    detail: {
      test: item.testName,
      ...(dilution ? { dilution: `1:${dilution}` } : {}),
    },
  })
  return item
}
