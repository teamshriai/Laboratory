// The quality system's reads and writes: quality indicators, EQA, CAPA,
// controlled documents, internal audits, risks, LIS verification,
// measurement uncertainty, equipment qualification and temperature logs.

import {
  addMonths,
  documentReviewDue,
  renewalState,
  riskLevel,
  uncertaintyFrom,
} from '@/domain/quality'
import { DAY, HOUR } from '@/domain/time'
import type { QcLevel } from '@/domain/types'
import { isReportReleased } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import {
  addFinding,
  advanceNc,
  approveDocument,
  completeAudit,
  createDocument,
  evaluateEqa,
  planAudit,
  raiseNc,
  recordQualification,
  recordTemperature,
  retireDocument,
  returnDocument,
  reviewLisVerification,
  reviseDocument,
  runLisVerification,
  saveColdUnit,
  saveRisk,
  startAudit,
  submitDocument,
  submitEqa,
  type AuditPlanInput,
  type ColdUnitInput,
  type DocumentInput,
  type NcInput,
  type NcStepInput,
  type RiskInput,
} from '../engine/quality'
import { read, write } from './runtime'
import type {
  ColdUnitRow,
  DocumentRow,
  EqaRow,
  InternalAuditRow,
  LisVerificationRow,
  NcRow,
  QualificationRow,
  QualityIndicator,
  QualityIndicatorKey,
  QualityOverview,
  RiskRow,
  UncertaintyRow,
} from './types'
import { staffName } from './views'

const WEEK = 7 * DAY
const pct = (n: number, d: number) =>
  d > 0 ? Math.round((n / d) * 1000) / 10 : null

/** Five weekly percentages, oldest first, for events in the window. */
function weekly<T>(
  rows: T[],
  at: (r: T) => number,
  hit: (r: T) => boolean,
  now: number,
) {
  const out: number[] = []
  for (let w = 4; w >= 0; w--) {
    const from = now - (w + 1) * WEEK
    const to = now - w * WEEK
    const inWeek = rows.filter((r) => at(r) > from && at(r) <= to)
    const value = pct(inWeek.filter(hit).length, inWeek.length)
    if (value !== null) out.push(value)
  }
  return out
}

function indicator(
  key: QualityIndicatorKey,
  numerator: number,
  denominator: number,
  target: number,
  higherIsBetter: boolean,
  trend: number[],
): QualityIndicator {
  const value = pct(numerator, denominator)
  return {
    key,
    value,
    target,
    higherIsBetter,
    status:
      value === null
        ? 'no-data'
        : (higherIsBetter ? value >= target : value <= target)
          ? 'met'
          : 'missed',
    trend,
    numerator,
    denominator,
  }
}

function indicators(db: LabDb, now: number): QualityIndicator[] {
  const t = db.settings.qualityTargets
  const since = now - 30 * DAY
  const stats = db.dailyStats.slice(-30)
  const samples = stats.reduce((n, d) => n + d.samples, 0)
  const rejected = stats.reduce((n, d) => n + d.rejected, 0)
  const tests = stats.reduce((n, d) => n + d.tests, 0)
  const delayed = stats.reduce((n, d) => n + (d.delayedPct / 100) * d.tests, 0)
  // Five weeks of daily averages, oldest first (the last 35 recorded days).
  const daily = db.dailyStats.slice(-35)
  const statTrend = (f: (d: (typeof daily)[number]) => number | null) =>
    [0, 1, 2, 3, 4]
      .map((w) => {
        const start = daily.length - (5 - w) * 7
        return daily.slice(Math.max(0, start), Math.max(0, start + 7))
      })
      .map((week) => {
        const vals = week.map(f).filter((v): v is number => v !== null)
        return vals.length
          ? Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 10) /
              10
          : null
      })
      .filter((v): v is number => v !== null)

  const criticals = Object.values(db.criticals).filter(
    (c) => c.detectedAt > since && c.status !== 'voided',
  )
  const limit = db.settings.criticalNotifyMin * 60_000
  const onTime = (c: (typeof criticals)[number]) =>
    c.notifiedAt !== undefined && c.notifiedAt - c.detectedAt <= limit

  const released = Object.values(db.reports).filter((r) => {
    const first = r.versions[0]?.releasedAt
    return isReportReleased(r) && first !== undefined && first > since
  })
  const amended = (r: (typeof released)[number]) =>
    r.versions.some((v) => v.kind === 'amended' || v.version > 1)

  const evaluated = Object.values(db.eqaRounds).filter(
    (e) => e.evaluatedAt && e.evaluatedAt > now - 365 * DAY,
  )
  const qc = Object.values(db.qcRuns).filter((r) => r.at > since)

  return [
    indicator(
      'rejection',
      rejected,
      samples,
      t.rejectionPct,
      false,
      statTrend((d) => (d.samples ? (d.rejected / d.samples) * 100 : null)),
    ),
    indicator(
      'tat-within',
      Math.round(tests - delayed),
      tests,
      t.tatWithinPct,
      true,
      statTrend((d) => (d.tests ? 100 - d.delayedPct : null)),
    ),
    indicator(
      'critical-on-time',
      criticals.filter(onTime).length,
      criticals.length,
      t.criticalOnTimePct,
      true,
      weekly(criticals, (c) => c.detectedAt, onTime, now),
    ),
    indicator(
      'amended',
      released.filter(amended).length,
      released.length,
      t.amendedPct,
      false,
      weekly(released, (r) => r.versions[0]!.releasedAt, amended, now),
    ),
    indicator(
      'eqa-acceptable',
      evaluated.filter((e) => e.outcome === 'acceptable').length,
      evaluated.length,
      t.eqaAcceptablePct,
      true,
      [],
    ),
    indicator(
      'iqc-failure',
      qc.filter((r) => r.result === 'fail').length,
      qc.length,
      // No configured target: flag above 5% failed runs.
      5,
      false,
      weekly(
        qc,
        (r) => r.at,
        (r) => r.result === 'fail',
        now,
      ),
    ),
  ]
}

const withNames = <T extends { by: string }>(db: LabDb, rows: T[]) =>
  rows.map((h) => ({ ...h, byName: staffName(db, h.by) }))

function ncRow(db: LabDb, nc: LabDb['ncs'][string], now: number): NcRow {
  return {
    ...nc,
    raisedByName: staffName(db, nc.raisedBy),
    ...(nc.ownerId ? { ownerName: staffName(db, nc.ownerId) } : {}),
    ...(nc.effectiveness
      ? { effectivenessByName: staffName(db, nc.effectiveness.by) }
      : {}),
    overdue: nc.state !== 'closed' && nc.dueAt !== undefined && nc.dueAt < now,
    history: withNames(db, nc.history),
  }
}

function riskRow(db: LabDb, r: LabDb['risks'][string], now: number): RiskRow {
  const { history: _history, ...rest } = r
  void _history
  const score = r.likelihood * r.severity
  const residualScore = r.residualLikelihood * r.residualSeverity
  return {
    ...rest,
    score,
    level: riskLevel(score),
    residualScore,
    residualLevel: riskLevel(residualScore),
    ownerName: staffName(db, r.ownerId),
    reviewOverdue: r.state !== 'closed' && r.reviewDueAt < now,
  }
}

function lastLisRun(db: LabDb) {
  return Object.values(db.lisVerifications).toSorted(
    (a, b) => b.performedAt - a.performedAt,
  )[0]
}

export const qualityApi = {
  overview: () =>
    read((db, { now }): QualityOverview => {
      const docs = Object.values(db.documents)
      const last = lastLisRun(db)
      const profile = db.settings.profile
      return {
        from: now - 30 * DAY,
        to: now,
        indicators: indicators(db, now),
        counts: {
          ncOpen: Object.values(db.ncs).filter((n) => n.state !== 'closed')
            .length,
          ncOverdue: Object.values(db.ncs).filter(
            (n) =>
              n.state !== 'closed' && n.dueAt !== undefined && n.dueAt < now,
          ).length,
          documentsInReview: docs.filter(
            (d) => d.versions.at(-1)?.state === 'in-review',
          ).length,
          documentsReviewDue: docs.filter((d) => {
            const due = documentReviewDue(d)
            return due !== null && due < now + 30 * DAY
          }).length,
          auditsPlanned: Object.values(db.internalAudits).filter(
            (a) => a.state === 'planned' || a.state === 'in-progress',
          ).length,
          risksHigh: Object.values(db.risks).filter(
            (r) =>
              r.state !== 'closed' &&
              ['high', 'extreme'].includes(
                riskLevel(r.residualLikelihood * r.residualSeverity),
              ),
          ).length,
          eqaPending: Object.values(db.eqaRounds).filter((e) => !e.submittedAt)
            .length,
          coldExcursions7d: Object.values(db.coldUnits).reduce(
            (n, u) =>
              n +
              u.readings.filter((r) => r.outOfRange && r.at > now - 7 * DAY)
                .length,
            0,
          ),
        },
        lisVerification: {
          lastAt: last?.performedAt ?? null,
          nextDueAt: last ? addMonths(last.performedAt, 6) : null,
        },
        registration: {
          validTo: profile.registrationValidTo,
          state: renewalState(profile.registrationValidTo, now),
          ...(profile.nablValidTo ? { nablValidTo: profile.nablValidTo } : {}),
        },
      }
    }),

  // ---------- EQA ----------
  eqa: () =>
    read((db, { now }): EqaRow[] =>
      Object.values(db.eqaRounds)
        .toSorted((a, b) => b.receivedAt - a.receivedAt)
        .map((e) => ({
          ...e,
          analyteName: db.analytes[e.analyteId]?.name ?? e.analyteId,
          unit: db.analytes[e.analyteId]?.unit ?? '',
          ...(e.equipmentId && db.equipment[e.equipmentId]
            ? { equipmentName: db.equipment[e.equipmentId]!.name }
            : {}),
          ...(e.submittedBy
            ? { submittedByName: staffName(db, e.submittedBy) }
            : {}),
          ...(e.evaluatedBy
            ? { evaluatedByName: staffName(db, e.evaluatedBy) }
            : {}),
          ...(e.ncId && db.ncs[e.ncId] ? { ncNo: db.ncs[e.ncId]!.ncNo } : {}),
          overdue: !e.submittedAt && e.dueAt < now,
        })),
    ),
  submitEqa: (id: string, value: number) =>
    write((db, ctx) => void submitEqa(db, id, value, ctx)),
  evaluateEqa: (id: string, input: { targetValue: number; targetSd: number }) =>
    write((db, ctx) => evaluateEqa(db, id, input, ctx).outcome ?? null),

  // ---------- Non-conformance and CAPA ----------
  ncs: () =>
    read((db, { now }): NcRow[] =>
      Object.values(db.ncs)
        .toSorted((a, b) => b.raisedAt - a.raisedAt)
        .map((n) => ncRow(db, n, now)),
    ),
  raiseNc: (input: NcInput) => write((db, ctx) => raiseNc(db, input, ctx).id),
  advanceNc: (id: string, input: NcStepInput) =>
    write((db, ctx) => void advanceNc(db, id, input, ctx)),

  // ---------- Controlled documents ----------
  documents: () =>
    read((db, { now }): DocumentRow[] =>
      Object.values(db.documents)
        .toSorted((a, b) => a.code.localeCompare(b.code))
        .map((d) => {
          const current = d.versions.findLast((v) => v.state === 'approved')
          const last = d.versions.at(-1)
          const pending =
            last && (last.state === 'draft' || last.state === 'in-review')
              ? last
              : undefined
          const reviewDueAt = documentReviewDue(d)
          const people = new Set(
            d.versions.flatMap((v) => [v.createdBy, v.approvedBy ?? '']),
          )
          return {
            ...d,
            ...(current ? { current } : {}),
            ...(pending ? { pending } : {}),
            reviewDueAt,
            reviewOverdue: reviewDueAt !== null && reviewDueAt < now,
            names: Object.fromEntries(
              [...people].filter(Boolean).map((id) => [id, staffName(db, id)]),
            ),
          }
        }),
    ),
  createDocument: (input: DocumentInput) =>
    write((db, ctx) => createDocument(db, input, ctx).id),
  reviseDocument: (id: string, summary: string) =>
    write((db, ctx) => void reviseDocument(db, id, summary, ctx)),
  submitDocument: (id: string) =>
    write((db, ctx) => void submitDocument(db, id, ctx)),
  approveDocument: (id: string) =>
    write((db, ctx) => void approveDocument(db, id, ctx)),
  returnDocument: (id: string, reason: string) =>
    write((db, ctx) => void returnDocument(db, id, reason, ctx)),
  retireDocument: (id: string, reason: string) =>
    write((db, ctx) => void retireDocument(db, id, reason, ctx)),

  // ---------- Internal audits ----------
  audits: () =>
    read((db): InternalAuditRow[] =>
      Object.values(db.internalAudits)
        .toSorted((a, b) => b.plannedFor - a.plannedFor)
        .map((a) => ({
          ...a,
          auditorName: staffName(db, a.auditorId),
          ncNos: Object.fromEntries(
            a.findings
              .filter((f) => f.ncId && db.ncs[f.ncId])
              .map((f) => [f.ncId!, db.ncs[f.ncId!]!.ncNo]),
          ),
        })),
    ),
  planAudit: (input: AuditPlanInput) =>
    write((db, ctx) => planAudit(db, input, ctx).id),
  startAudit: (id: string) => write((db, ctx) => void startAudit(db, id, ctx)),
  addFinding: (id: string, input: Parameters<typeof addFinding>[2]) =>
    write((db, ctx) => void addFinding(db, id, input, ctx)),
  completeAudit: (id: string, summary: string) =>
    write((db, ctx) => void completeAudit(db, id, summary, ctx)),

  // ---------- Risk register ----------
  risks: () =>
    read((db, { now }): RiskRow[] =>
      Object.values(db.risks)
        .map((r) => riskRow(db, r, now))
        .toSorted(
          (a, b) => b.residualScore - a.residualScore || b.score - a.score,
        ),
    ),
  saveRisk: (input: RiskInput) =>
    write((db, ctx) => saveRisk(db, input, ctx).id),

  // ---------- LIS verification ----------
  lisVerifications: () =>
    read((db): LisVerificationRow[] =>
      Object.values(db.lisVerifications)
        .toSorted((a, b) => b.performedAt - a.performedAt)
        .map((r) => ({
          ...r,
          performedByName: staffName(db, r.performedBy),
          ...(r.reviewedBy
            ? { reviewedByName: staffName(db, r.reviewedBy) }
            : {}),
        })),
    ),
  runLisVerification: (note?: string) =>
    write(
      (db, ctx) =>
        runLisVerification(db, note !== undefined ? { note } : {}, ctx).id,
    ),
  reviewLisVerification: (id: string) =>
    write((db, ctx) => void reviewLisVerification(db, id, ctx)),

  // ---------- Measurement uncertainty ----------
  /** From the last six months of IQC, per analyser, analyte and level. */
  uncertainty: () =>
    read((db, { now }): UncertaintyRow[] => {
      const since = now - 183 * DAY
      const groups = new Map<string, number[]>()
      for (const r of Object.values(db.qcRuns)) {
        if (r.at < since) continue
        const key = `${r.equipmentId}|${r.analyteId}|${r.level}`
        groups.set(key, [...(groups.get(key) ?? []), r.value])
      }
      const lastEqa = (analyteId: string) =>
        Object.values(db.eqaRounds)
          .filter(
            (e) =>
              e.analyteId === analyteId &&
              e.reportedValue !== undefined &&
              e.targetValue,
          )
          .toSorted((a, b) => (b.evaluatedAt ?? 0) - (a.evaluatedAt ?? 0))[0]
      return [...groups]
        .map(([key, values]) => {
          const [equipmentId, analyteId, level] = key.split('|') as [
            string,
            string,
            QcLevel,
          ]
          const eqa = lastEqa(analyteId)
          return {
            analyteId,
            analyteName: db.analytes[analyteId]?.name ?? analyteId,
            unit: db.analytes[analyteId]?.unit ?? '',
            equipmentId,
            equipmentName: db.equipment[equipmentId]?.name ?? equipmentId,
            level,
            uncertainty: uncertaintyFrom(values),
            n: values.length,
            eqaBiasPct:
              eqa?.targetValue && eqa.reportedValue !== undefined
                ? Math.round(
                    ((eqa.reportedValue - eqa.targetValue) / eqa.targetValue) *
                      1000,
                  ) / 10
                : null,
          }
        })
        .toSorted(
          (a, b) =>
            a.equipmentName.localeCompare(b.equipmentName) ||
            a.analyteName.localeCompare(b.analyteName) ||
            a.level.localeCompare(b.level),
        )
    }),

  // ---------- Equipment qualification and cold storage ----------
  qualifications: (equipmentId?: string) =>
    read((db): QualificationRow[] =>
      Object.values(db.qualifications)
        .filter((q) => !equipmentId || q.equipmentId === equipmentId)
        .toSorted((a, b) => b.at - a.at)
        .map((q) => ({
          ...q,
          equipmentName: db.equipment[q.equipmentId]?.name ?? q.equipmentId,
          byName: staffName(db, q.by),
        })),
    ),
  recordQualification: (input: Parameters<typeof recordQualification>[1]) =>
    write((db, ctx) => recordQualification(db, input, ctx).id),
  coldUnits: () =>
    read((db, { now }): ColdUnitRow[] =>
      Object.values(db.coldUnits)
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .map(({ readings, ...unit }) => {
          const named = readings
            .filter((r) => r.at > now - 14 * DAY)
            .map((r) => ({ ...r, byName: staffName(db, r.by) }))
          return {
            ...unit,
            ...(named[0] ? { latest: named[0] } : {}),
            readings: named.toReversed(),
            excursions7d: readings.filter(
              (r) => r.outOfRange && r.at > now - 7 * DAY,
            ).length,
            readingOverdue: !readings[0] || readings[0].at < now - 14 * HOUR,
          }
        }),
    ),
  saveColdUnit: (input: ColdUnitInput) =>
    write((db, ctx) => saveColdUnit(db, input, ctx).id),
  recordTemperature: (id: string, input: { value: number; action?: string }) =>
    write((db, ctx) => void recordTemperature(db, id, input, ctx)),
}
