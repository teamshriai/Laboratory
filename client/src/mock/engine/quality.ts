// The quality system beyond IQC (NABL 112A / ISO 15189:2022): EQA rounds,
// non-conformances with CAPA, controlled documents, internal audits, the
// risk register, LIS verification runs, equipment qualification and
// temperature logs. Every change is audited.

import { nextSequence } from '@/domain/ids'
import {
  NC_NEXT,
  eqaOutcome,
  eqaZScore,
  isRiskRating,
  isTemperatureInRange,
} from '@/domain/quality'
import { randomToken } from '@/domain/sha256'
import { DAY, istDayCompact } from '@/domain/time'
import {
  COLD_UNIT_KINDS,
  DEPARTMENTS,
  DOCUMENT_KINDS,
  FINDING_KINDS,
  NC_SEVERITIES,
  NC_SOURCES,
  QUALIFICATION_KINDS,
  RISK_STATES,
  type AuditFinding,
  type ColdUnit,
  type ControlledDocument,
  type DepartmentId,
  type EquipmentQualification,
  type FindingKind,
  type InternalAudit,
  type LisCheck,
  type LisVerification,
  type NcSeverity,
  type NcSource,
  type NcState,
  type NonConformance,
  type QualificationKind,
  type Risk,
  type RiskState,
} from '@/domain/types'
import { isReportReleased } from '@/domain/workflow'
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

const isDept = (d: string): d is DepartmentId | 'all' =>
  d === 'all' || (DEPARTMENTS as readonly string[]).includes(d)

// ---------- Non-conformance and CAPA ----------

export interface NcInput {
  source: NcSource
  severity: NcSeverity
  title: string
  description: string
  department: DepartmentId | 'all'
  relatedId?: string
}

export function raiseNc(db: LabDb, input: NcInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'quality.record')
  if (!NC_SOURCES.includes(input.source))
    throw new LabApiError('validation-failed', { field: 'source' })
  if (!NC_SEVERITIES.includes(input.severity))
    throw new LabApiError('validation-failed', { field: 'severity' })
  if (!isDept(input.department))
    throw new LabApiError('validation-failed', { field: 'department' })
  const nc: NonConformance = {
    id: id('nc'),
    ncNo: nextSequence(
      Object.values(db.ncs).map((n) => n.ncNo),
      `NC-${istDayCompact(ctx.now).slice(0, 4)}-`,
      3,
    ),
    source: input.source,
    severity: input.severity,
    title: text(input.title, 'title', 200),
    description: text(input.description, 'description'),
    department: input.department,
    ...(input.relatedId ? { relatedId: input.relatedId } : {}),
    raisedAt: ctx.now,
    raisedBy: ctx.by,
    state: 'open',
    history: [history(ctx, 'nc-raised')],
  }
  db.ncs[nc.id] = nc
  audit(db, ctx, 'quality', nc.id, 'nc-raised', {
    detail: { nc: nc.ncNo, severity: nc.severity, source: nc.source },
  })
  return nc
}

export interface NcStepInput {
  to: NcState
  ownerId?: string
  dueAt?: number
  correction?: string
  rootCause?: string
  correctiveAction?: string
  preventiveAction?: string
  /** Verifying -> closed or back to action. */
  effective?: boolean
  note?: string
}

/**
 * Moves a non-conformance along the CAPA path. Each step needs its record:
 * an owner and due date to investigate, the root cause before action, the
 * corrective action before verification, and an effectiveness check (by
 * someone other than the owner) to close.
 */
export function advanceNc(
  db: LabDb,
  ncId: string,
  input: NcStepInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'quality.manage')
  const nc = must(db.ncs, ncId, 'nc')
  if (!NC_NEXT[nc.state].includes(input.to))
    throw new LabApiError('invalid-transition', {
      from: nc.state,
      to: input.to,
    })
  const from = nc.state
  switch (input.to) {
    case 'investigating': {
      const owner = must(db.staff, input.ownerId, 'staff')
      if (!input.dueAt || input.dueAt < ctx.now)
        throw new LabApiError('validation-failed', { field: 'dueAt' })
      nc.ownerId = owner.id
      nc.dueAt = input.dueAt
      if (input.correction?.trim()) nc.correction = input.correction.trim()
      break
    }
    case 'action':
      if (from === 'investigating')
        nc.rootCause = text(input.rootCause, 'rootCause')
      else nc.effectiveness = undefined
      break
    case 'verifying':
      nc.correctiveAction = text(input.correctiveAction, 'correctiveAction')
      if (input.preventiveAction?.trim())
        nc.preventiveAction = input.preventiveAction.trim()
      break
    case 'closed':
      break
    case 'open':
      throw new LabApiError('invalid-transition', { from, to: input.to })
  }
  if (from === 'verifying') {
    if (input.effective === undefined)
      throw new LabApiError('validation-failed', { field: 'effective' })
    if (input.effective !== (input.to === 'closed'))
      throw new LabApiError('invalid-transition', { from, to: input.to })
    if (nc.ownerId === ctx.by) throw new LabApiError('independent-approval')
    nc.effectiveness = {
      at: ctx.now,
      by: ctx.by,
      effective: input.effective,
      note: text(input.note, 'note'),
    }
  }
  nc.state = input.to
  if (input.to === 'closed') nc.closedAt = ctx.now
  nc.history.push(history(ctx, `nc-${input.to}`))
  audit(db, ctx, 'quality', nc.id, 'nc-step', {
    from,
    to: input.to,
    detail: { nc: nc.ncNo },
  })
  return nc
}

// ---------- EQA / proficiency testing ----------

export function submitEqa(
  db: LabDb,
  roundId: string,
  value: number,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'quality.record')
  const round = must(db.eqaRounds, roundId, 'eqa')
  if (round.submittedAt) throw new LabApiError('invalid-transition', {})
  if (!Number.isFinite(value)) throw new LabApiError('not-numeric')
  round.reportedValue = value
  round.submittedAt = ctx.now
  round.submittedBy = ctx.by
  audit(db, ctx, 'quality', round.id, 'eqa-submitted', {
    detail: { round: `${round.scheme} ${round.roundNo}`, value },
  })
  return round
}

/**
 * Records the provider's assigned value and SD, scores the result and, for
 * an unacceptable one, raises a non-conformance.
 */
export function evaluateEqa(
  db: LabDb,
  roundId: string,
  input: { targetValue: number; targetSd: number },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'quality.manage')
  const round = must(db.eqaRounds, roundId, 'eqa')
  if (round.reportedValue === undefined || round.evaluatedAt)
    throw new LabApiError('invalid-transition', {})
  const z = eqaZScore(round.reportedValue, input.targetValue, input.targetSd)
  if (z === null || !Number.isFinite(input.targetValue))
    throw new LabApiError('validation-failed', { field: 'targetSd' })
  round.targetValue = input.targetValue
  round.targetSd = input.targetSd
  round.zScore = z
  round.outcome = eqaOutcome(z)
  round.evaluatedAt = ctx.now
  round.evaluatedBy = ctx.by
  audit(db, ctx, 'quality', round.id, 'eqa-evaluated', {
    to: round.outcome,
    detail: { round: `${round.scheme} ${round.roundNo}`, z },
  })
  if (round.outcome === 'unacceptable') {
    const analyte = db.analytes[round.analyteId]
    const nc = raiseNc(
      db,
      {
        source: 'eqa',
        severity: 'major',
        title: `EQA ${round.scheme} ${round.roundNo}: ${analyte?.name ?? round.analyteId} unacceptable (z ${z})`,
        description: `Reported ${round.reportedValue}, assigned ${input.targetValue} (SD ${input.targetSd}).`,
        department: 'all',
        relatedId: round.id,
      },
      ctx,
    )
    round.ncId = nc.id
  }
  return round
}

// ---------- Controlled documents ----------

export interface DocumentInput {
  code: string
  title: string
  kind: ControlledDocument['kind']
  department: DepartmentId | 'all'
  reviewMonths: number
  summary: string
}

export function createDocument(
  db: LabDb,
  input: DocumentInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'document.author')
  const code = text(input.code, 'code', 40).toUpperCase()
  if (Object.values(db.documents).some((d) => d.code === code))
    throw new LabApiError('duplicate-code', { code })
  if (!DOCUMENT_KINDS.includes(input.kind))
    throw new LabApiError('validation-failed', { field: 'kind' })
  if (!isDept(input.department))
    throw new LabApiError('validation-failed', { field: 'department' })
  if (
    !Number.isInteger(input.reviewMonths) ||
    input.reviewMonths < 1 ||
    input.reviewMonths > 60
  )
    throw new LabApiError('validation-failed', { field: 'reviewMonths' })
  const doc: ControlledDocument = {
    id: id('doc'),
    code,
    title: text(input.title, 'title', 200),
    kind: input.kind,
    department: input.department,
    reviewMonths: input.reviewMonths,
    versions: [
      {
        version: '1.0',
        state: 'draft',
        summary: text(input.summary, 'summary'),
        createdAt: ctx.now,
        createdBy: ctx.by,
      },
    ],
  }
  db.documents[doc.id] = doc
  audit(db, ctx, 'quality', doc.id, 'document-created', {
    detail: { code, version: '1.0' },
  })
  return doc
}

const nextVersion = (v: string) => {
  const [major = 1] = v.split('.').map(Number)
  return `${major + 1}.0`
}

/** Starts a revision of an approved document (one draft at a time). */
export function reviseDocument(
  db: LabDb,
  docId: string,
  summary: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'document.author')
  const doc = must(db.documents, docId, 'document')
  const last = doc.versions.at(-1)!
  if (last.state === 'draft' || last.state === 'in-review')
    throw new LabApiError('invalid-transition', { from: last.state })
  const version = nextVersion(last.version)
  doc.versions.push({
    version,
    state: 'draft',
    summary: text(summary, 'summary'),
    createdAt: ctx.now,
    createdBy: ctx.by,
  })
  audit(db, ctx, 'quality', doc.id, 'document-revised', {
    detail: { code: doc.code, version },
  })
  return doc
}

export function submitDocument(db: LabDb, docId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'document.author')
  const doc = must(db.documents, docId, 'document')
  const last = doc.versions.at(-1)!
  if (last.state !== 'draft')
    throw new LabApiError('invalid-transition', { from: last.state })
  last.state = 'in-review'
  audit(db, ctx, 'quality', doc.id, 'document-submitted', {
    detail: { code: doc.code, version: last.version },
  })
  return doc
}

/**
 * Authorises the version in review; it takes effect and the previous one
 * is retired. The author may not authorise their own version.
 */
export function approveDocument(db: LabDb, docId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'document.approve')
  const doc = must(db.documents, docId, 'document')
  const last = doc.versions.at(-1)!
  if (last.state !== 'in-review')
    throw new LabApiError('invalid-transition', { from: last.state })
  if (last.createdBy === ctx.by) throw new LabApiError('independent-approval')
  for (const v of doc.versions)
    if (v.state === 'approved') {
      v.state = 'retired'
      v.retiredAt = ctx.now
    }
  last.state = 'approved'
  last.approvedAt = ctx.now
  last.approvedBy = ctx.by
  last.effectiveFrom = ctx.now
  audit(db, ctx, 'quality', doc.id, 'document-approved', {
    detail: { code: doc.code, version: last.version },
  })
  return doc
}

/** Sends a version in review back to draft, with the reason. */
export function returnDocument(
  db: LabDb,
  docId: string,
  reason: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'document.approve')
  const doc = must(db.documents, docId, 'document')
  const last = doc.versions.at(-1)!
  if (last.state !== 'in-review')
    throw new LabApiError('invalid-transition', { from: last.state })
  last.state = 'draft'
  audit(db, ctx, 'quality', doc.id, 'document-returned', {
    reason: text(reason, 'reason'),
    detail: { code: doc.code, version: last.version },
  })
  return doc
}

export function retireDocument(
  db: LabDb,
  docId: string,
  reason: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'document.approve')
  const doc = must(db.documents, docId, 'document')
  const current = doc.versions.findLast((v) => v.state === 'approved')
  if (!current) throw new LabApiError('invalid-transition', {})
  current.state = 'retired'
  current.retiredAt = ctx.now
  audit(db, ctx, 'quality', doc.id, 'document-retired', {
    reason: text(reason, 'reason'),
    detail: { code: doc.code, version: current.version },
  })
  return doc
}

// ---------- Internal audits ----------

export interface AuditPlanInput {
  area: string
  clauses: string
  department: DepartmentId | 'all'
  plannedFor: number
  auditorId: string
}

export function planAudit(db: LabDb, input: AuditPlanInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'quality.manage')
  const auditor = must(db.staff, input.auditorId, 'staff')
  if (!isDept(input.department))
    throw new LabApiError('validation-failed', { field: 'department' })
  if (!Number.isFinite(input.plannedFor))
    throw new LabApiError('validation-failed', { field: 'plannedFor' })
  // Auditors do not audit their own work (ISO 15189 8.8.3).
  if (input.department !== 'all' && auditor.department === input.department)
    throw new LabApiError('auditor-not-independent')
  const plan: InternalAudit = {
    id: id('ia'),
    auditNo: nextSequence(
      Object.values(db.internalAudits).map((a) => a.auditNo),
      `IA-${istDayCompact(input.plannedFor).slice(0, 4)}-`,
      2,
    ),
    area: text(input.area, 'area', 200),
    clauses: text(input.clauses, 'clauses', 200),
    department: input.department,
    plannedFor: input.plannedFor,
    auditorId: auditor.id,
    state: 'planned',
    findings: [],
  }
  db.internalAudits[plan.id] = plan
  audit(db, ctx, 'quality', plan.id, 'audit-planned', {
    detail: { audit: plan.auditNo, area: plan.area },
  })
  return plan
}

export function startAudit(db: LabDb, auditId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'quality.record')
  const plan = must(db.internalAudits, auditId, 'audit')
  if (plan.state !== 'planned')
    throw new LabApiError('invalid-transition', { from: plan.state })
  plan.state = 'in-progress'
  plan.startedAt = ctx.now
  audit(db, ctx, 'quality', plan.id, 'audit-started', {
    detail: { audit: plan.auditNo },
  })
  return plan
}

/** A nonconformity found in an audit raises a non-conformance. */
export function addFinding(
  db: LabDb,
  auditId: string,
  input: { kind: FindingKind; clause: string; text: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'quality.record')
  const plan = must(db.internalAudits, auditId, 'audit')
  if (plan.state !== 'in-progress')
    throw new LabApiError('invalid-transition', { from: plan.state })
  if (!FINDING_KINDS.includes(input.kind))
    throw new LabApiError('validation-failed', { field: 'kind' })
  const finding: AuditFinding = {
    id: id('fd'),
    kind: input.kind,
    clause: text(input.clause, 'clause', 40),
    text: text(input.text, 'text'),
  }
  if (finding.kind === 'nonconformity') {
    const nc = raiseNc(
      db,
      {
        source: 'internal-audit',
        severity: 'minor',
        title: `${plan.auditNo} clause ${finding.clause}`,
        description: finding.text,
        department: plan.department,
        relatedId: plan.id,
      },
      ctx,
    )
    finding.ncId = nc.id
  }
  plan.findings.push(finding)
  audit(db, ctx, 'quality', plan.id, 'audit-finding', {
    detail: { audit: plan.auditNo, kind: finding.kind, clause: finding.clause },
  })
  return plan
}

export function completeAudit(
  db: LabDb,
  auditId: string,
  summary: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'quality.record')
  const plan = must(db.internalAudits, auditId, 'audit')
  if (plan.state !== 'in-progress')
    throw new LabApiError('invalid-transition', { from: plan.state })
  plan.state = 'completed'
  plan.completedAt = ctx.now
  plan.summary = text(summary, 'summary')
  audit(db, ctx, 'quality', plan.id, 'audit-completed', {
    detail: { audit: plan.auditNo, findings: plan.findings.length },
  })
  return plan
}

// ---------- Risk register ----------

export type RiskInput = Omit<Risk, 'id' | 'riskNo' | 'history' | 'state'> & {
  id?: string
  state?: RiskState
}

export function saveRisk(db: LabDb, input: RiskInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'quality.manage')
  for (const [field, v] of [
    ['likelihood', input.likelihood],
    ['severity', input.severity],
    ['residualLikelihood', input.residualLikelihood],
    ['residualSeverity', input.residualSeverity],
  ] as const)
    if (!isRiskRating(v)) throw new LabApiError('validation-failed', { field })
  must(db.staff, input.ownerId, 'staff')
  if (input.state && !RISK_STATES.includes(input.state))
    throw new LabApiError('validation-failed', { field: 'state' })
  const existing = input.id ? must(db.risks, input.id, 'risk') : undefined
  const risk: Risk = {
    id: existing?.id ?? id('rk'),
    riskNo:
      existing?.riskNo ??
      nextSequence(
        Object.values(db.risks).map((r) => r.riskNo),
        'RSK-',
        3,
      ),
    title: text(input.title, 'title', 200),
    process: text(input.process, 'process', 200),
    hazard: text(input.hazard, 'hazard'),
    likelihood: input.likelihood,
    severity: input.severity,
    controls: text(input.controls, 'controls'),
    residualLikelihood: input.residualLikelihood,
    residualSeverity: input.residualSeverity,
    ownerId: input.ownerId,
    reviewDueAt: input.reviewDueAt,
    state: input.state ?? existing?.state ?? 'open',
    history: [
      ...(existing?.history ?? []),
      history(ctx, existing ? 'risk-reviewed' : 'risk-added'),
    ],
  }
  db.risks[risk.id] = risk
  audit(db, ctx, 'quality', risk.id, existing ? 'risk-updated' : 'risk-added', {
    ...(existing && existing.state !== risk.state
      ? { from: existing.state, to: risk.state }
      : {}),
    detail: {
      risk: risk.riskNo,
      score: risk.likelihood * risk.severity,
      residual: risk.residualLikelihood * risk.residualSeverity,
    },
  })
  return risk
}

// ---------- LIS verification ----------

export const LIS_MIN_CHECKS = 10

/**
 * Compares, for released results from at least ten specimens, the value
 * the analyser sent (simulated in this build), the value stored in the LIS
 * and the value printed in the report's latest version.
 */
export function runLisVerification(
  db: LabDb,
  input: { note?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'quality.record')
  const checks: LisCheck[] = []
  const seenSpecimens = new Set<string>()
  const reports = Object.values(db.reports)
    .filter(
      (r) =>
        isReportReleased(r) &&
        !r.withdrawn &&
        (r.versions.at(-1)?.releasedAt ?? Infinity) <= ctx.now,
    )
    .toSorted(
      (a, b) =>
        (b.versions.at(-1)?.releasedAt ?? 0) -
        (a.versions.at(-1)?.releasedAt ?? 0),
    )
  for (const report of reports) {
    if (checks.length >= 2 * LIS_MIN_CHECKS) break
    const snapshot = report.versions.at(-1)?.snapshot ?? []
    for (const reported of snapshot) {
      const result = db.results[reported.resultId]
      if (!result || result.value === null || result.calculated) continue
      const item = db.items[result.orderItemId]
      const sample = item?.sampleId ? db.samples[item.sampleId] : undefined
      if (!item || !sample?.accessionNo || seenSpecimens.has(sample.id))
        continue
      seenSpecimens.add(sample.id)
      const lisValue = result.value
      checks.push({
        accessionNo: sample.accessionNo,
        sampleId: sample.id,
        specimen: sample.specimen,
        testCode: db.tests[item.testId]?.code ?? item.testId,
        analyte: reported.analyteName,
        // The analyser value is the first value received, before any
        // correction (simulated: no analyser is connected in this build).
        instrumentValue:
          result.source && result.source !== 'manual'
            ? (result.revisions[0]?.value ?? lisValue)
            : lisValue,
        lisValue,
        reportValue: reported.value,
        match: lisValue === reported.value,
      })
      break
    }
  }
  if (checks.length < LIS_MIN_CHECKS)
    throw new LabApiError('too-few-checks', { min: LIS_MIN_CHECKS })
  const run: LisVerification = {
    id: id('lisv'),
    runNo: nextSequence(
      Object.values(db.lisVerifications).map((r) => r.runNo),
      `LISV-${istDayCompact(ctx.now).slice(0, 4)}-`,
      2,
    ),
    performedAt: ctx.now,
    performedBy: ctx.by,
    checks,
    outcome: checks.every((c) => c.match) ? 'pass' : 'fail',
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  }
  db.lisVerifications[run.id] = run
  audit(db, ctx, 'quality', run.id, 'lis-verified', {
    to: run.outcome,
    detail: { run: run.runNo, checks: checks.length },
  })
  return run
}

export function reviewLisVerification(
  db: LabDb,
  runId: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'quality.manage')
  const run = must(db.lisVerifications, runId, 'verification')
  if (run.reviewedAt) throw new LabApiError('invalid-transition', {})
  if (run.performedBy === ctx.by) throw new LabApiError('independent-approval')
  run.reviewedAt = ctx.now
  run.reviewedBy = ctx.by
  audit(db, ctx, 'quality', run.id, 'lis-reviewed', {
    detail: { run: run.runNo },
  })
  return run
}

// ---------- Equipment qualification and temperature logs ----------

export function recordQualification(
  db: LabDb,
  input: {
    equipmentId: string
    kind: QualificationKind
    outcome: 'pass' | 'fail'
    reference: string
    at?: number
    note?: string
  },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'equipment.manage')
  const eq = must(db.equipment, input.equipmentId, 'equipment')
  if (!QUALIFICATION_KINDS.includes(input.kind))
    throw new LabApiError('validation-failed', { field: 'kind' })
  const at = input.at ?? ctx.now
  if (at > ctx.now) throw new LabApiError('date-in-future')
  const record: EquipmentQualification = {
    id: id('qual'),
    equipmentId: eq.id,
    kind: input.kind,
    at,
    by: ctx.by,
    outcome: input.outcome === 'fail' ? 'fail' : 'pass',
    reference: text(input.reference, 'reference', 120),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  }
  db.qualifications[record.id] = record
  audit(db, ctx, 'equipment', eq.id, `qualification-${record.kind}`, {
    to: record.outcome,
    detail: { reference: record.reference },
  })
  return record
}

export type ColdUnitInput = Omit<ColdUnit, 'id' | 'readings'> & { id?: string }

export function saveColdUnit(db: LabDb, input: ColdUnitInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'equipment.manage')
  if (!COLD_UNIT_KINDS.includes(input.kind))
    throw new LabApiError('validation-failed', { field: 'kind' })
  if (!isDept(input.department))
    throw new LabApiError('validation-failed', { field: 'department' })
  if (
    !Number.isFinite(input.min) ||
    !Number.isFinite(input.max) ||
    input.min >= input.max
  )
    throw new LabApiError('validation-failed', { field: 'range' })
  const existing = input.id ? must(db.coldUnits, input.id, 'unit') : undefined
  const unit: ColdUnit = {
    id: existing?.id ?? id('cold'),
    name: text(input.name, 'name', 120),
    kind: input.kind,
    location: text(input.location, 'location', 120),
    department: input.department,
    min: input.min,
    max: input.max,
    readings: existing?.readings ?? [],
  }
  db.coldUnits[unit.id] = unit
  audit(
    db,
    ctx,
    'equipment',
    unit.id,
    existing ? 'cold-unit-updated' : 'cold-unit-added',
    {
      detail: { name: unit.name, range: `${unit.min} - ${unit.max} °C` },
    },
  )
  return unit
}

export const MAX_READINGS = 400

/** Logs a temperature; an out-of-range reading needs the action taken. */
export function recordTemperature(
  db: LabDb,
  unitId: string,
  input: { value: number; action?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'quality.record')
  const unit = must(db.coldUnits, unitId, 'unit')
  if (!Number.isFinite(input.value) || input.value < -100 || input.value > 100)
    throw new LabApiError('implausible-value', { value: input.value })
  const outOfRange = !isTemperatureInRange(input.value, unit.min, unit.max)
  const action = input.action?.trim()
  if (outOfRange && !action) throw new LabApiError('action-required')
  unit.readings.unshift({
    id: id('tr'),
    at: ctx.now,
    by: ctx.by,
    value: input.value,
    outOfRange,
    ...(action ? { action } : {}),
  })
  if (unit.readings.length > MAX_READINGS) unit.readings.length = MAX_READINGS
  if (outOfRange)
    audit(db, ctx, 'equipment', unit.id, 'temperature-excursion', {
      reason: action,
      detail: { name: unit.name, value: input.value },
    })
  return unit
}

/** Days until a date (negative when overdue); for reminders. */
export const daysUntil = (at: number, now: number) =>
  Math.floor((at - now) / DAY)
