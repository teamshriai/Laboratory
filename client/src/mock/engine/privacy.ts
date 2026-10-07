// Privacy (DPDP Act 2023 / Rules 2025): data principals' requests with
// due dates, the breach and incident register with the CERT-In (6 h) and
// Board (72 h) deadlines, legal holds and the retention policy.

import { nextSequence } from '@/domain/ids'
import { dataRequestDue } from '@/domain/quality'
import { randomToken } from '@/domain/sha256'
import { istDayCompact } from '@/domain/time'
import {
  BREACH_STEPS,
  DATA_REQUEST_KINDS,
  type BreachStep,
  RECORD_CLASSES,
  type Breach,
  type DataRequest,
  type DataRequestKind,
  type DataRequestState,
  type LegalHold,
  type RetentionRule,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  history,
  LabApiError,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

const id = (prefix: string) =>
  `${prefix}_${randomToken(6)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}`

const text = (value: string | undefined, field: string, max = 2000) => {
  const v = value?.trim() ?? ''
  if (!v || v.length > max)
    throw new LabApiError('validation-failed', { field })
  return v
}

export function activeHold(
  db: LabDb,
  entity: LegalHold['entity'],
  entityId: string,
) {
  return Object.values(db.legalHolds).find(
    (h) => h.entity === entity && h.entityId === entityId && !h.releasedAt,
  )
}

// ---------- Data principals' requests ----------

export interface DataRequestInput {
  kind: DataRequestKind
  patientId?: string
  requesterName: string
  contact: string
  details: string
  /** When it arrived (defaults to now; never in the future). */
  receivedAt?: number
}

export function logDataRequest(
  db: LabDb,
  input: DataRequestInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'privacy.manage')
  if (!DATA_REQUEST_KINDS.includes(input.kind))
    throw new LabApiError('validation-failed', { field: 'kind' })
  if (input.patientId) must(db.patients, input.patientId, 'patient')
  const receivedAt = input.receivedAt ?? ctx.now
  if (receivedAt > ctx.now) throw new LabApiError('date-in-future')
  const request: DataRequest = {
    id: id('dsr'),
    requestNo: nextSequence(
      Object.values(db.dataRequests).map((r) => r.requestNo),
      `DSR-${istDayCompact(receivedAt).slice(0, 4)}-`,
      3,
    ),
    kind: input.kind,
    ...(input.patientId ? { patientId: input.patientId } : {}),
    requesterName: text(input.requesterName, 'requesterName', 120),
    contact: text(input.contact, 'contact', 120),
    details: text(input.details, 'details'),
    receivedAt,
    dueAt: dataRequestDue(receivedAt, db.settings.dataRequestDays),
    state: 'received',
    history: [history(ctx, 'request-received')],
  }
  db.dataRequests[request.id] = request
  audit(db, ctx, 'privacy', request.id, 'request-logged', {
    detail: { request: request.requestNo, kind: request.kind },
  })
  return request
}

const REQUEST_NEXT: Record<DataRequestState, DataRequestState[]> = {
  received: ['verifying', 'refused'],
  verifying: ['in-progress', 'refused'],
  'in-progress': ['completed', 'refused'],
  completed: [],
  refused: [],
}

/**
 * Moves a request along. Completing or refusing needs the response given
 * to the person; erasure cannot complete while a legal hold stands, and
 * clinical records under retention are kept (the response says so).
 */
export function advanceDataRequest(
  db: LabDb,
  requestId: string,
  input: { to: DataRequestState; response?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'privacy.manage')
  const request = must(db.dataRequests, requestId, 'request')
  if (!REQUEST_NEXT[request.state].includes(input.to))
    throw new LabApiError('invalid-transition', {
      from: request.state,
      to: input.to,
    })
  if (input.to === 'completed' || input.to === 'refused')
    request.response = text(input.response, 'response')
  if (
    input.to === 'completed' &&
    request.kind === 'erasure' &&
    request.patientId &&
    activeHold(db, 'patient', request.patientId)
  )
    throw new LabApiError('legal-hold')
  const from = request.state
  request.state = input.to
  if (input.to === 'completed' || input.to === 'refused')
    request.closedAt = ctx.now
  request.history.push(history(ctx, `request-${input.to}`))
  audit(db, ctx, 'privacy', request.id, 'request-step', {
    from,
    to: input.to,
    detail: { request: request.requestNo },
  })
  return request
}

// ---------- Breaches and incidents ----------

export interface BreachInput {
  title: string
  description: string
  detectedAt: number
  affectedCount: number
  dataKinds: string
}

export function logBreach(db: LabDb, input: BreachInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'privacy.manage')
  if (!Number.isFinite(input.detectedAt) || input.detectedAt > ctx.now)
    throw new LabApiError('date-in-future')
  if (!Number.isInteger(input.affectedCount) || input.affectedCount < 0)
    throw new LabApiError('validation-failed', { field: 'affectedCount' })
  const breach: Breach = {
    id: id('brc'),
    breachNo: nextSequence(
      Object.values(db.breaches).map((b) => b.breachNo),
      `INC-${istDayCompact(input.detectedAt).slice(0, 4)}-`,
      3,
    ),
    title: text(input.title, 'title', 200),
    description: text(input.description, 'description'),
    detectedAt: input.detectedAt,
    detectedBy: ctx.by,
    affectedCount: input.affectedCount,
    dataKinds: text(input.dataKinds, 'dataKinds', 300),
    state: 'open',
    history: [history(ctx, 'breach-logged')],
  }
  db.breaches[breach.id] = breach
  audit(db, ctx, 'privacy', breach.id, 'breach-logged', {
    detail: { incident: breach.breachNo, affected: breach.affectedCount },
  })
  return breach
}

/** Records a reporting step; closing needs containment and both reports. */
export function updateBreach(
  db: LabDb,
  breachId: string,
  step: BreachStep,
  note: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'privacy.manage')
  const breach = must(db.breaches, breachId, 'incident')
  if (breach.state === 'closed') throw new LabApiError('invalid-transition', {})
  if (!BREACH_STEPS.includes(step))
    throw new LabApiError('validation-failed', { field: 'step' })
  const already = {
    'cert-in-reported': breach.certInReportedAt,
    'board-reported': breach.boardReportedAt,
    'principals-notified': breach.principalsNotifiedAt,
    contained: breach.containedAt,
    closed: breach.closedAt,
  }[step]
  if (already) throw new LabApiError('invalid-transition', {})
  const reason = text(note, 'note')
  const from = breach.state
  switch (step) {
    case 'cert-in-reported':
      breach.certInReportedAt = ctx.now
      break
    case 'board-reported':
      breach.boardReportedAt = ctx.now
      break
    case 'principals-notified':
      breach.principalsNotifiedAt = ctx.now
      break
    case 'contained':
      breach.containedAt = ctx.now
      breach.state = 'contained'
      break
    case 'closed':
      if (
        !breach.containedAt ||
        !breach.certInReportedAt ||
        !breach.boardReportedAt
      )
        throw new LabApiError('invalid-transition', {
          from: breach.state,
          to: 'closed',
        })
      breach.closedAt = ctx.now
      breach.state = 'closed'
      break
  }
  breach.history.push(history(ctx, `breach-${step}`, { note: reason }))
  audit(db, ctx, 'privacy', breach.id, `breach-${step}`, {
    reason,
    ...(from !== breach.state ? { from, to: breach.state } : {}),
    detail: { incident: breach.breachNo },
  })
  return breach
}

// ---------- Legal holds and retention ----------

export function placeHold(
  db: LabDb,
  input: { entity: LegalHold['entity']; entityId: string; reason: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'privacy.manage')
  if (input.entity === 'patient') must(db.patients, input.entityId, 'patient')
  else if (input.entity === 'report') must(db.reports, input.entityId, 'report')
  else throw new LabApiError('validation-failed', { field: 'entity' })
  if (activeHold(db, input.entity, input.entityId))
    throw new LabApiError('legal-hold')
  const hold: LegalHold = {
    id: id('hold'),
    entity: input.entity,
    entityId: input.entityId,
    reason: text(input.reason, 'reason'),
    placedAt: ctx.now,
    placedBy: ctx.by,
  }
  db.legalHolds[hold.id] = hold
  audit(db, ctx, input.entity, input.entityId, 'legal-hold-placed', {
    reason: hold.reason,
  })
  return hold
}

export function releaseHold(
  db: LabDb,
  holdId: string,
  reason: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'privacy.manage')
  const hold = must(db.legalHolds, holdId, 'hold')
  if (hold.releasedAt) throw new LabApiError('invalid-transition', {})
  hold.releasedAt = ctx.now
  hold.releasedBy = ctx.by
  hold.releaseReason = text(reason, 'reason')
  audit(db, ctx, hold.entity, hold.entityId, 'legal-hold-released', {
    reason: hold.releaseReason,
  })
  return hold
}

export function saveRetention(
  db: LabDb,
  rules: RetentionRule[],
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'settings.edit')
  const seen = new Set<string>()
  for (const r of rules) {
    if (!RECORD_CLASSES.includes(r.recordClass) || seen.has(r.recordClass))
      throw new LabApiError('validation-failed', { field: 'recordClass' })
    seen.add(r.recordClass)
    if (!Number.isInteger(r.months) || r.months < 1 || r.months > 600)
      throw new LabApiError('validation-failed', { field: 'months' })
    text(r.basis, 'basis', 200)
  }
  const before = db.settings.retention
  db.settings.retention = rules.map((r) => ({ ...r, basis: r.basis.trim() }))
  audit(db, ctx, 'settings', 'retention', 'retention-updated', {
    from: before.map((r) => `${r.recordClass}:${r.months}`).join(', '),
    to: rules.map((r) => `${r.recordClass}:${r.months}`).join(', '),
  })
  return db.settings.retention
}
