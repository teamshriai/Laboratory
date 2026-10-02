import { uid } from '@/domain/ids'
import { evaluateQc } from '@/domain/qc'
import type { QcEvent, QcEventStatus, QcLevel, QcRun } from '@/domain/types'
import type { LabDb } from '../db/schema'
import { consumeReagentsFor } from './inventory'
import {
  audit,
  LabApiError,
  logActivity,
  must,
  notify,
  type EngineCtx,
  requirePermission,
} from './core'

export interface QcRunInput {
  equipmentId: string
  analyteId: string
  level: QcLevel
  value: number
  correctiveAction?: string
}

export function qcSeries(
  db: LabDb,
  equipmentId: string,
  analyteId: string,
  level: QcLevel,
) {
  return Object.values(db.qcRuns)
    .filter(
      (r) =>
        r.equipmentId === equipmentId &&
        r.analyteId === analyteId &&
        r.level === level,
    )
    .toSorted((a, b) => b.at - a.at)
}

export function recordQcRun(
  db: LabDb,
  input: QcRunInput,
  ctx: EngineCtx,
): QcRun {
  requirePermission(db, ctx, 'qc.record')
  const eq = must(db.equipment, input.equipmentId, 'equipment')
  const analyte = must(db.analytes, input.analyteId, 'analyte')
  if (!Number.isFinite(input.value))
    throw new LabApiError('validation-failed', { field: 'value' })
  const series = qcSeries(db, eq.id, analyte.id, input.level)
  const control = controlLotFor(db, eq.id, analyte.id, input.level, ctx.now)
  const last = series[0]
  const target = control
    ? { mean: control.mean, sd: control.sd, lot: control.lotNumber }
    : last
      ? { mean: last.mean, sd: last.sd, lot: last.controlLot }
      : null
  if (!target) throw new LabApiError('validation-failed', { field: 'level' })
  const previousZ = series.slice(0, 3).map((r) => (r.value - r.mean) / r.sd)
  const evaluation = evaluateQc(input.value, target.mean, target.sd, previousZ)
  const run: QcRun = {
    id: uid('qc'),
    equipmentId: eq.id,
    analyteId: analyte.id,
    level: input.level,
    controlLot: target.lot,
    at: ctx.now,
    by: ctx.by,
    value: input.value,
    mean: target.mean,
    sd: target.sd,
    result: evaluation.result,
    ...(evaluation.rule ? { rule: evaluation.rule } : {}),
    ...(input.correctiveAction?.trim()
      ? { correctiveAction: input.correctiveAction.trim() }
      : {}),
  }
  db.qcRuns[run.id] = run
  trackQcEvent(db, run, ctx)
  // A control run uses reagent like a patient test does.
  const qcTests = Object.values(db.tests)
    .filter((t) => t.analyteIds.includes(analyte.id))
    .map((t) => t.id)
    .slice(0, 1)
  consumeReagentsFor(db, eq.id, qcTests, `QC ${input.level}`, ctx)
  if (run.result === 'fail')
    notify(
      db,
      ctx,
      'qc-failed',
      'danger',
      {
        equipment: eq.name,
        analyte: analyte.name,
        level: input.level,
        rule: run.rule ?? '',
      },
      '/quality-control',
    )
  if (run.result !== 'pass')
    audit(db, ctx, 'qc', run.id, `qc-${run.result}`, {
      detail: {
        equipment: eq.name,
        analyte: analyte.name,
        level: input.level,
        rule: run.rule ?? '',
      },
    })
  logActivity(
    db,
    ctx,
    'qc-recorded',
    { equipment: eq.name, analyte: analyte.name, result: run.result },
    '/quality-control',
  )
  return run
}

export function controlLotFor(
  db: LabDb,
  equipmentId: string,
  analyteId: string,
  level: QcLevel,
  now: number,
) {
  return Object.values(db.controlLots)
    .filter(
      (c) =>
        c.equipmentId === equipmentId &&
        c.analyteId === analyteId &&
        c.level === level &&
        c.expiresAt > now,
    )
    .toSorted((a, b) => a.expiresAt - b.expiresAt)[0]
}

export function openQcEvent(
  db: LabDb,
  equipmentId: string,
  analyteId: string,
  level: QcLevel,
) {
  return Object.values(db.qcEvents).find(
    (e) =>
      e.status !== 'resolved' &&
      e.equipmentId === equipmentId &&
      e.analyteId === analyteId &&
      e.level === level,
  )
}

function step(ctx: EngineCtx, status: QcEventStatus, note: string) {
  return { id: uid('qcs'), status, at: ctx.now, by: ctx.by, note }
}

/** Opens a failure event on a failed run and resolves it on a passing repeat. */
function trackQcEvent(db: LabDb, run: QcRun, ctx: EngineCtx) {
  const open = openQcEvent(db, run.equipmentId, run.analyteId, run.level)
  if (run.result === 'fail') {
    if (open) {
      open.status = 'investigating'
      open.steps.push(step(ctx, 'investigating', run.rule ?? ''))
      return
    }
    const event: QcEvent = {
      id: uid('qce'),
      runId: run.id,
      equipmentId: run.equipmentId,
      analyteId: run.analyteId,
      level: run.level,
      openedAt: ctx.now,
      status: 'open',
      steps: [step(ctx, 'open', run.rule ?? '')],
    }
    db.qcEvents[event.id] = event
    return
  }
  if (open && open.status === 'repeat-pending') {
    open.status = 'resolved'
    open.resolvedByRunId = run.id
    open.resolvedAt = ctx.now
    open.steps.push(step(ctx, 'resolved', ''))
  }
}

const NEXT: Partial<Record<QcEventStatus, QcEventStatus>> = {
  open: 'investigating',
  investigating: 'corrective',
  corrective: 'repeat-pending',
}

/** Moves a QC failure event one step forward with the operator's note. */
export function advanceQcEvent(
  db: LabDb,
  eventId: string,
  note: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'qc.record')
  const event = must(db.qcEvents, eventId, 'qc-event')
  const next = NEXT[event.status]
  if (!next) throw new LabApiError('invalid-transition', { from: event.status })
  const text = note.trim()
  if (!text) throw new LabApiError('validation-failed', { field: 'note' })
  if (next === 'investigating') event.issue = text
  if (next === 'corrective') event.action = text
  const from = event.status
  event.status = next
  event.steps.push(step(ctx, next, text))
  const run = db.qcRuns[event.runId]
  if (run && next === 'corrective')
    run.correctiveAction = event.issue ? `${event.issue} ${text}` : text
  audit(db, ctx, 'qc', event.id, 'event-advanced', {
    from,
    to: next,
    reason: text,
  })
  return event
}
