// The referring doctor's view: only patients this doctor ordered tests for,
// only released reports, abnormal and critical results first. The check is
// here, in the API (a backend enforces it the same way); screens only show
// what comes back.

import { isReportReleased } from '@/domain/workflow'
import { isAbnormal, isCriticalFlag } from '@/domain/flags'
import type { LabDb } from '../db/schema'
import { LabApiError, requirePermission } from '../engine/core'
import type { DbIndex } from './index-cache'
import { paginate, type Sorters } from './paging'
import { read } from './runtime'
import type {
  DoctorPatientDetail,
  DoctorPatientList,
  DoctorPatientRow,
  PageQuery,
  TrendSeries,
} from './types'
import {
  matchesQuery,
  patientSearchFields,
  patientSummary,
  reportRow,
} from './views'

/** The doctor record the acting user stands for, or a refusal. */
function doctorOf(db: LabDb, actor: string, now: number) {
  const staff = requirePermission(db, { now, by: actor }, 'portal.doctor')
  if (!staff.doctorId)
    throw new LabApiError('not-found', { entity: 'doctor', id: actor })
  return staff.doctorId
}

function releasedReportsFor(
  db: LabDb,
  index: DbIndex,
  doctorId: string,
  patientId: string,
) {
  return Object.values(db.reports)
    .filter((r) => {
      if (r.patientId !== patientId || r.withdrawn || !isReportReleased(r))
        return false
      return db.orders[r.orderId]?.doctorId === doctorId
    })
    .map((r) => reportRow(db, index, r))
}

const SORTERS: Sorters<DoctorPatientRow> = {
  patient: (r) => r.patient.name,
  latest: (r) => r.latestReportAt ?? 0,
  flags: (r) => r.criticalCount * 100 + r.abnormalCount,
}

export const doctorApi = {
  /** This doctor's patients with released reports, newest first. */
  patients: (filters: PageQuery & { q?: string } = {}) =>
    read((db, { index, actor, now }): DoctorPatientList => {
      const doctorId = doctorOf(db, actor, now)
      const patientIds = new Set(
        Object.values(db.orders)
          .filter((o) => o.doctorId === doctorId && o.state === 'active')
          .map((o) => o.patientId),
      )
      const rows: DoctorPatientRow[] = []
      for (const id of patientIds) {
        const p = db.patients[id]
        if (!p || p.mergedInto) continue
        if (!matchesQuery(filters.q, patientSearchFields(p))) continue
        const reports = releasedReportsFor(db, index, doctorId, id)
        const latest = reports.toSorted(
          (a, b) => (b.releasedAt ?? 0) - (a.releasedAt ?? 0),
        )[0]
        rows.push({
          patient: patientSummary(p),
          reportCount: reports.length,
          abnormalCount: reports.reduce((n, r) => n + r.abnormalCount, 0),
          criticalCount: reports.reduce((n, r) => n + r.criticalCount, 0),
          ...(latest?.releasedAt !== undefined
            ? { latestReportAt: latest.releasedAt, latestReportId: latest.id }
            : {}),
        })
      }
      // Patients with something to look at first, then the newest reports.
      const ordered = rows.toSorted(
        (a, b) =>
          b.criticalCount - a.criticalCount ||
          (b.latestReportAt ?? 0) - (a.latestReportAt ?? 0),
      )
      return {
        doctorName: db.doctors[doctorId]?.name ?? '',
        ...paginate(ordered, filters, SORTERS),
      }
    }),

  /** One patient: released reports and result trends from this doctor's orders. */
  patient: (patientId: string) =>
    read((db, { index, actor, now }): DoctorPatientDetail => {
      const doctorId = doctorOf(db, actor, now)
      const patient = db.patients[patientId]
      const ordered = Object.values(db.orders).some(
        (o) => o.patientId === patientId && o.doctorId === doctorId,
      )
      // Another doctor's patient is refused exactly like a missing one.
      if (!patient || !ordered)
        throw new LabApiError('not-found', { entity: 'patient', id: patientId })
      const reports = releasedReportsFor(
        db,
        index,
        doctorId,
        patientId,
      ).toSorted((a, b) => (b.releasedAt ?? 0) - (a.releasedAt ?? 0))
      const series = new Map<string, TrendSeries>()
      for (const [key, points] of index.history) {
        const [pid, analyteId] = key.split(':') as [string, string]
        if (pid !== patientId) continue
        const analyte = db.analytes[analyteId]
        if (!analyte || analyte.resultType !== 'numeric') continue
        const mine = points.filter(
          (p) => db.orders[p.orderId]?.doctorId === doctorId,
        )
        if (mine.length === 0) continue
        // The reference interval recorded with the newest of these results.
        const newest = mine.reduce((a, b) => (b.at > a.at ? b : a))
        const range =
          index.resultsByItem
            .get(newest.itemId)
            ?.find((r) => r.analyteId === analyteId)?.range ?? null
        series.set(analyteId, {
          analyteId,
          name: analyte.name,
          unit: analyte.unit,
          range,
          points: mine
            .map((p) => ({ at: p.at, value: Number(p.value), flag: p.flag }))
            .filter((p) => Number.isFinite(p.value))
            .toSorted((a, b) => a.at - b.at),
        })
      }
      const flagged = [...series.values()].filter((s) =>
        s.points.some((p) => isAbnormal(p.flag)),
      )
      return {
        patient: patientSummary(patient),
        reports,
        // Abnormal analytes first: what the doctor most needs to see.
        trends: [
          ...flagged,
          ...[...series.values()].filter((s) => !flagged.includes(s)),
        ].filter((s) => s.points.length > 0),
        criticalAnalytes: flagged
          .filter((s) =>
            s.points.some((p) => {
              const analyte = db.analytes[s.analyteId]
              return analyte ? isCriticalFlag(analyte, p.flag) : false
            }),
          )
          .map((s) => s.name),
      }
    }),
}

/**
 * A referring doctor may open only released reports from their own
 * orders; anything else is refused as not found (as the server must).
 */
export function ensureDoctorMayRead(
  db: LabDb,
  actor: string,
  reportId: string,
) {
  const staff = db.staff[actor]
  if (staff?.role !== 'doctor') return
  const report = db.reports[reportId]
  if (
    !report ||
    report.withdrawn ||
    !isReportReleased(report) ||
    !staff.doctorId ||
    db.orders[report.orderId]?.doctorId !== staff.doctorId
  )
    throw new LabApiError('not-found', { entity: 'report', id: reportId })
}
