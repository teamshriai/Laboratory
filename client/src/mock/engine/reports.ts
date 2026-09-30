import { computeFlag } from '@/domain/flags'
import { uid } from '@/domain/ids'
import type {
  CorrectionReason,
  PendingAmendment,
  ReportedValue,
  ShareChannel,
} from '@/domain/types'
import { deriveReportStatus, isReportReleased } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import {
  audit,
  itemsOfReport,
  LabApiError,
  logActivity,
  must,
  notify,
  resultsOfItem,
  type EngineCtx,
} from './core'
import { syncCriticalAlert } from './results'

const reportLink = (id: string) => `/laboratory/reports/${id}`

function openCriticalsFor(db: LabDb, reportId: string) {
  const itemIds = new Set(itemsOfReport(db, reportId).map((i) => i.id))
  return Object.values(db.criticals).filter(
    (a) =>
      itemIds.has(a.orderItemId) &&
      (a.status === 'open' || a.status === 'notified'),
  )
}

const SIGNATORIES = ['pathologist', 'microbiologist']
const REQUESTERS = ['technician', 'lab-manager', ...SIGNATORIES]

function ensureRole(
  db: LabDb,
  ctx: EngineCtx,
  roles: string[],
  code: 'not-authorized-releaser' | 'not-authorized-reviewer',
) {
  const staff = db.staff[ctx.by]
  if (!staff || !roles.includes(staff.role))
    throw new LabApiError(code, { name: staff?.name ?? ctx.by })
}

/** The released values of a report, for a version snapshot. */
function snapshotOf(db: LabDb, reportId: string): ReportedValue[] {
  const out: ReportedValue[] = []
  for (const item of itemsOfReport(db, reportId)) {
    if (item.status !== 'validated') continue
    for (const r of resultsOfItem(db, item.id)) {
      if (r.value === null) continue
      out.push({
        resultId: r.id,
        analyteName: db.analytes[r.analyteId]?.name ?? r.analyteId,
        value: r.value,
        unit: r.unit,
        flag: r.flag,
      })
    }
  }
  return out
}

/** Signs and releases a fully validated report (pathologist only). */
export function releaseReport(db: LabDb, reportId: string, ctx: EngineCtx) {
  ensureRole(db, ctx, SIGNATORIES, 'not-authorized-releaser')
  const report = must(db.reports, reportId, 'report')
  const items = itemsOfReport(db, reportId)
  if (isReportReleased(report)) throw new LabApiError('invalid-transition')
  if (deriveReportStatus(report, items) !== 'validated')
    throw new LabApiError('report-not-validated', { report: report.reportNo })
  const open = openCriticalsFor(db, reportId)
  if (open.length > 0)
    throw new LabApiError('critical-unacknowledged', { count: open.length })
  report.versions.push({
    version: 1,
    releasedAt: ctx.now,
    releasedBy: ctx.by,
    snapshot: snapshotOf(db, reportId),
  })
  const patient = db.patients[report.patientId]
  const params = { report: report.reportNo, patient: patient?.name ?? '' }
  audit(db, ctx, 'report', report.id, 'released', {
    detail: { report: report.reportNo, version: 1 },
  })
  notify(db, ctx, 'report-released', 'success', params, reportLink(report.id))
  logActivity(db, ctx, 'report-released', params, reportLink(report.id))
  return report
}

export interface CorrectionInput {
  corrections: { resultId: string; value: string }[]
  reason: CorrectionReason
  comments: string
}

/**
 * Requests a correction to a released report. Nothing changes on the report
 * until a pathologist authorises it; the released version stays current.
 */
export function requestCorrection(
  db: LabDb,
  reportId: string,
  input: CorrectionInput,
  ctx: EngineCtx,
) {
  ensureRole(db, ctx, REQUESTERS, 'not-authorized-reviewer')
  const report = must(db.reports, reportId, 'report')
  if (!isReportReleased(report)) throw new LabApiError('report-not-released')
  if (report.pendingAmendment) throw new LabApiError('amendment-pending')
  const comments = input.comments.trim()
  if (!comments) throw new LabApiError('reason-required')
  const itemIds = new Set(itemsOfReport(db, reportId).map((i) => i.id))
  const changes: PendingAmendment['changes'] = []
  for (const c of input.corrections) {
    const result = must(db.results, c.resultId, 'result')
    if (!itemIds.has(result.orderItemId))
      throw new LabApiError('validation-failed', { field: 'resultId' })
    const value = c.value.trim()
    if (!value || value === result.value) continue
    const analyte = must(db.analytes, result.analyteId, 'analyte')
    changes.push({
      resultId: result.id,
      analyteName: analyte.name,
      from: result.value ?? '',
      fromFlag: result.flag,
      to: value,
      toFlag: computeFlag(analyte, value, result.range),
      unit: result.unit,
    })
  }
  if (changes.length === 0)
    throw new LabApiError('validation-failed', { field: 'corrections' })
  report.pendingAmendment = {
    requestedAt: ctx.now,
    requestedBy: ctx.by,
    reason: input.reason,
    comments,
    changes,
  }
  const version = report.versions.at(-1)!.version + 1
  audit(db, ctx, 'report', report.id, 'correction-requested', {
    reason: `${input.reason}: ${comments}`,
    detail: {
      report: report.reportNo,
      changes: changes
        .map((c) => `${c.analyteName} ${c.from} -> ${c.to}`)
        .join('; '),
    },
  })
  logActivity(
    db,
    ctx,
    'report-correction-requested',
    { report: report.reportNo, version },
    reportLink(report.id),
  )
  return report
}

/** A pathologist authorises the requested correction and releases it. */
export function authoriseCorrection(
  db: LabDb,
  reportId: string,
  ctx: EngineCtx,
) {
  ensureRole(db, ctx, SIGNATORIES, 'not-authorized-releaser')
  const report = must(db.reports, reportId, 'report')
  const pending = report.pendingAmendment
  if (!pending) throw new LabApiError('no-amendment-pending')
  const current = report.versions.at(-1)!.version
  const corrected: string[] = []
  for (const c of pending.changes) {
    const result = must(db.results, c.resultId, 'result')
    const analyte = must(db.analytes, result.analyteId, 'analyte')
    result.revisions.push({
      value: result.value ?? '',
      flag: result.flag,
      at: result.updatedAt,
      by: result.updatedBy,
      reportVersion: current,
      reason: pending.reason,
      comments: pending.comments,
    })
    result.value = c.to
    result.flag = computeFlag(analyte, c.to, result.range)
    result.updatedAt = ctx.now
    result.updatedBy = ctx.by
    syncCriticalAlert(db, result, db.items[result.orderItemId]!, ctx)
    corrected.push(result.id)
  }
  report.versions.push({
    version: current + 1,
    releasedAt: ctx.now,
    releasedBy: ctx.by,
    correctionReason: pending.reason,
    correctionComments: pending.comments,
    correctedResultIds: corrected,
    requestedBy: pending.requestedBy,
    requestedAt: pending.requestedAt,
    snapshot: snapshotOf(db, reportId),
  })
  delete report.pendingAmendment
  if (report.shareLog.length > 0) report.renotifyPending = true
  const patient = db.patients[report.patientId]
  const params = {
    report: report.reportNo,
    patient: patient?.name ?? '',
    version: current + 1,
  }
  audit(db, ctx, 'report', report.id, 'correction-authorised', {
    reason: `${pending.reason}: ${pending.comments}`,
    detail: { report: report.reportNo, version: current + 1 },
  })
  notify(db, ctx, 'report-corrected', 'warning', params, reportLink(report.id))
  logActivity(db, ctx, 'report-corrected', params, reportLink(report.id))
  return report
}

/** Declines a requested correction; the released report stays as it was. */
export function rejectCorrection(
  db: LabDb,
  reportId: string,
  reason: string,
  ctx: EngineCtx,
) {
  ensureRole(db, ctx, SIGNATORIES, 'not-authorized-releaser')
  const report = must(db.reports, reportId, 'report')
  if (!report.pendingAmendment) throw new LabApiError('no-amendment-pending')
  if (!reason.trim()) throw new LabApiError('reason-required')
  delete report.pendingAmendment
  audit(db, ctx, 'report', report.id, 'correction-declined', {
    reason: reason.trim(),
    detail: { report: report.reportNo },
  })
  return report
}

/** Request and authorise in one step (a pathologist correcting their own report). */
export function correctReport(
  db: LabDb,
  reportId: string,
  input: CorrectionInput,
  ctx: EngineCtx,
) {
  requestCorrection(db, reportId, input, ctx)
  return authoriseCorrection(db, reportId, ctx)
}

export function shareReport(
  db: LabDb,
  reportId: string,
  input: { channel: ShareChannel; recipient: string },
  ctx: EngineCtx,
) {
  const report = must(db.reports, reportId, 'report')
  if (!isReportReleased(report)) throw new LabApiError('report-not-released')
  const recipient = input.recipient.trim()
  if (!recipient)
    throw new LabApiError('validation-failed', { field: 'recipient' })
  report.shareLog.unshift({
    id: uid('shr'),
    at: ctx.now,
    by: ctx.by,
    channel: input.channel,
    recipient,
    version: report.versions.at(-1)!.version,
  })
  report.renotifyPending = false
  logActivity(
    db,
    ctx,
    'report-shared',
    { report: report.reportNo, channel: input.channel },
    reportLink(report.id),
  )
  return report
}

export function recordPrint(db: LabDb, reportId: string, ctx: EngineCtx) {
  const report = must(db.reports, reportId, 'report')
  report.printCount += 1
  report.lastPrintedAt = ctx.now
  return report
}

export function setInterpretation(db: LabDb, reportId: string, text: string) {
  const report = must(db.reports, reportId, 'report')
  if (isReportReleased(report)) throw new LabApiError('invalid-transition')
  const trimmed = text.trim()
  if (trimmed) report.interpretation = trimmed
  else delete report.interpretation
  return report
}
