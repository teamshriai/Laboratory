import { uid } from '@/domain/ids'
import type {
  CriticalAlert,
  NotifyMethod,
  NotifyOutcome,
  NotifyRole,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  history,
  LabApiError,
  logActivity,
  must,
  notify,
  requirePermission,
  type EngineCtx,
} from './core'
import { isFullName } from '@/domain/critical'

export interface DocumentCriticalInput {
  notifiedTo: string
  role: NotifyRole
  method: NotifyMethod
  notifiedAt: number
  remarks?: string
  /** Whether the clinician was reached on this attempt (default: reached). */
  outcome?: NotifyOutcome
  /** The clinician read the value back and acknowledged it on this call. */
  acknowledged: boolean
  readBack: boolean
}

const PENDING = ['open', 'notified'] as const

function ensurePending(alert: CriticalAlert) {
  if (!(PENDING as readonly string[]).includes(alert.status))
    throw new LabApiError('invalid-transition', { from: alert.status })
}

function names(db: LabDb, alert: CriticalAlert) {
  return {
    patient: db.patients[alert.patientId]?.name ?? '',
    analyte: db.analytes[alert.analyteId]?.name ?? '',
  }
}

/**
 * Records one attempt to communicate a critical value. An attempt that did
 * not reach anyone stays on the log (the alert shows as "contacting"); a
 * reached clinician makes it notified, and acknowledged if they read the
 * value back.
 */
export function documentCritical(
  db: LabDb,
  alertId: string,
  input: DocumentCriticalInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'critical.communicate')
  const alert = must(db.criticals, alertId, 'critical')
  ensurePending(alert)
  const to = input.notifiedTo.trim()
  if (!to) throw new LabApiError('validation-failed', { field: 'notifiedTo' })
  if (input.notifiedAt > ctx.now || input.notifiedAt < alert.detectedAt)
    throw new LabApiError('validation-failed', { field: 'notifiedAt' })
  const outcome = input.outcome ?? 'reached'
  if (outcome === 'reached' && !isFullName(to))
    throw new LabApiError('recipient-full-name')
  if (input.acknowledged && outcome !== 'reached')
    throw new LabApiError('invalid-transition', { from: outcome })
  if (input.acknowledged && !input.readBack)
    throw new LabApiError('readback-required')
  const remarks = input.remarks?.trim()

  alert.attempts.push({
    id: uid('att'),
    at: input.notifiedAt,
    by: ctx.by,
    to,
    role: input.role,
    method: input.method,
    outcome,
    ...(remarks ? { remarks } : {}),
  })
  alert.history.push(
    history(ctx, 'critical-attempt', { to, method: input.method, outcome }),
  )
  audit(db, ctx, 'critical', alert.id, 'notification-attempt', {
    detail: { to, method: input.method, outcome },
  })
  if (outcome !== 'reached') return alert

  alert.notifiedTo = to
  alert.notifiedRole = input.role
  alert.method = input.method
  alert.notifiedAt = input.notifiedAt
  alert.notifiedBy = ctx.by
  if (remarks) alert.notifyRemarks = remarks
  alert.status = 'notified'
  if (input.acknowledged) {
    alert.status = 'acknowledged'
    alert.acknowledgedAt = input.notifiedAt
    alert.acknowledgedBy = ctx.by
    alert.readBack = true
    alert.history.push(history(ctx, 'critical-acknowledged', { to }))
    audit(db, ctx, 'critical', alert.id, 'acknowledged', { detail: { to } })
  }
  logActivity(
    db,
    ctx,
    input.acknowledged ? 'critical-acknowledged' : 'critical-notified',
    names(db, alert),
    `/critical-results?alert=${alert.id}`,
  )
  return alert
}

/** The notified clinician read the value back and acknowledged it. */
export function acknowledgeCritical(
  db: LabDb,
  alertId: string,
  input: { acknowledgedAt: number; readBack: boolean; remarks?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'critical.communicate')
  const alert = must(db.criticals, alertId, 'critical')
  if (alert.status !== 'notified')
    throw new LabApiError('invalid-transition', { from: alert.status })
  if (!input.readBack) throw new LabApiError('readback-required')
  if (
    input.acknowledgedAt > ctx.now + 60_000 ||
    input.acknowledgedAt < (alert.notifiedAt ?? alert.detectedAt) - 60_000
  )
    throw new LabApiError('validation-failed', { field: 'acknowledgedAt' })
  alert.status = 'acknowledged'
  alert.acknowledgedAt = input.acknowledgedAt
  alert.acknowledgedBy = ctx.by
  alert.readBack = true
  if (input.remarks?.trim()) alert.ackRemarks = input.remarks.trim()
  alert.history.push(history(ctx, 'critical-acknowledged'))
  audit(db, ctx, 'critical', alert.id, 'acknowledged')
  logActivity(
    db,
    ctx,
    'critical-acknowledged',
    names(db, alert),
    `/critical-results?alert=${alert.id}`,
  )
  return alert
}

/**
 * Raises the value to a senior clinician (unit in-charge, consultant) when
 * the ordering doctor cannot be reached in time.
 */
export function escalateCritical(
  db: LabDb,
  alertId: string,
  input: { to: string; reason: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'critical.communicate')
  const alert = must(db.criticals, alertId, 'critical')
  ensurePending(alert)
  const to = input.to.trim()
  const reason = input.reason.trim()
  if (!to) throw new LabApiError('validation-failed', { field: 'to' })
  if (!reason) throw new LabApiError('reason-required')
  alert.escalatedAt = ctx.now
  alert.escalatedBy = ctx.by
  alert.escalatedTo = to
  alert.escalationReason = reason
  alert.history.push(history(ctx, 'critical-escalated', { to, reason }))
  audit(db, ctx, 'critical', alert.id, 'escalated', {
    reason,
    detail: { to },
  })
  notify(
    db,
    ctx,
    'critical-escalated',
    'danger',
    { ...names(db, alert), to },
    `/critical-results?alert=${alert.id}`,
  )
  logActivity(
    db,
    ctx,
    'critical-escalated',
    { ...names(db, alert), to },
    `/critical-results?alert=${alert.id}`,
  )
  return alert
}

/** Marks an alert as not applicable (e.g. a confirmed analytical error). */
export function voidCritical(
  db: LabDb,
  alertId: string,
  reason: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'critical.communicate')
  const alert = must(db.criticals, alertId, 'critical')
  ensurePending(alert)
  if (!reason.trim()) throw new LabApiError('reason-required')
  voidAlert(alert, reason.trim(), ctx)
  audit(db, ctx, 'critical', alert.id, 'voided', { reason: reason.trim() })
  return alert
}

/** Voids a pending alert; used when its result, test or sample goes away. */
export function voidAlert(
  alert: CriticalAlert,
  reason: string,
  ctx: EngineCtx,
) {
  if (alert.status !== 'open' && alert.status !== 'notified') return
  alert.status = 'voided'
  alert.voidedAt = ctx.now
  alert.voidReason = reason
  alert.history.push(history(ctx, 'critical-voided', { reason }))
}
