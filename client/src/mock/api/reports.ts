import {
  REPORT_STATUSES,
  type ReportStatus,
  type ShareChannel,
} from '@/domain/types'
import { isItemEntered, isItemLive } from '@/domain/workflow'
import { must } from '../engine/core'
import {
  authoriseCorrection,
  correctReport,
  rejectCorrection,
  requestCorrection,
  recordPrint,
  releaseReport,
  setInterpretation,
  shareReport,
} from '../engine/reports'
import { read, write } from './runtime'
import type {
  CorrectionRequest,
  ReportDetail,
  ReportFilters,
  ReportListResult,
  ReportRow,
  ReportSection,
} from './types'
import {
  doctorRef,
  inDateRange,
  matchesQuery,
  patientSearchFields,
  patientSummary,
  reportRow,
  staffName,
} from './views'

export const reportsApi = {
  list: (filters: ReportFilters = {}) =>
    read((db, { index, now }): ReportListResult => {
      const rows: ReportRow[] = []
      for (const report of Object.values(db.reports)) {
        const order = db.orders[report.orderId]
        if (!order || order.state !== 'active') continue
        const items = (index.itemsByReport.get(report.id) ?? []).filter(
          isItemLive,
        )
        if (items.length === 0) continue
        if (filters.patientId && report.patientId !== filters.patientId)
          continue
        if (filters.department && report.department !== filters.department)
          continue
        if (
          !inDateRange(
            report.versions.at(-1)?.releasedAt ?? order.orderedAt,
            filters.date,
            now,
          )
        )
          continue
        const patient = db.patients[report.patientId]!
        if (
          !matchesQuery(filters.q, [
            ...patientSearchFields(patient),
            report.reportNo,
            order.orderNo,
          ])
        )
          continue
        rows.push(reportRow(db, index, report))
      }
      const counts = Object.fromEntries([
        ['all', rows.length],
        ...REPORT_STATUSES.map((s) => [s, 0]),
      ]) as Record<ReportStatus | 'all', number>
      for (const r of rows) counts[r.status] += 1
      const status = filters.status ?? 'all'
      return {
        rows: rows
          .filter((r) => status === 'all' || r.status === status)
          .toSorted(
            (a, b) =>
              (b.releasedAt ?? b.createdAt) - (a.releasedAt ?? a.createdAt),
          ),
        counts,
      }
    }),

  get: (id: string) =>
    read((db, { index }): ReportDetail => {
      const report = must(db.reports, id, 'report')
      const order = db.orders[report.orderId]!
      const patient = db.patients[report.patientId]!
      const items = (index.itemsByReport.get(id) ?? []).filter(isItemLive)
      const row = reportRow(db, index, report)
      const sections: ReportSection[] = items.map((item) => {
        const test = db.tests[item.testId]
        const results = index.resultsByItem.get(item.id) ?? []
        const section: ReportSection = {
          itemId: item.id,
          testName: item.testName,
          code: item.testCode,
          status: item.status,
          rows: item.analyteIds
            .map((analyteId) => {
              const r = results.find((x) => x.analyteId === analyteId)
              const analyte = db.analytes[analyteId]!
              if (!r || r.value === null) return null
              return {
                resultId: r.id,
                analyteId,
                name: analyte.name,
                unit: r.unit,
                resultType: analyte.resultType,
                ...(analyte.posnegStyle
                  ? { posnegStyle: analyte.posnegStyle }
                  : {}),
                ...(analyte.resultType === 'select' && analyte.normalOptions
                  ? { expected: analyte.normalOptions }
                  : analyte.resultType === 'posneg'
                    ? { expected: ['negative'] }
                    : {}),
                value: r.value,
                flag: r.flag,
                range: r.range,
                previousVersions: r.revisions
                  .filter((rev) => rev.reportVersion !== undefined)
                  .map((rev) => ({
                    version: rev.reportVersion!,
                    value: rev.value,
                    flag: rev.flag,
                  })),
                ...(r.remarks ? { remarks: r.remarks } : {}),
              }
            })
            .filter((x) => x !== null),
          comments: item.comments
            .filter((c) => c.visibility === 'report')
            .map((c) => c.text),
        }
        if (test?.method) section.method = test.method
        if (item.validatedAt) section.validatedAt = item.validatedAt
        if (item.validatedBy)
          section.validatedBy = staffName(db, item.validatedBy)
        return section
      })
      const validator = items.find((i) => i.validatedBy)?.validatedBy
      const pathologistStaff = validator ? db.staff[validator] : undefined
      const openCriticals = items.reduce(
        (n, i) =>
          n +
          (index.criticalsByItem.get(i.id) ?? []).filter(
            (c) => c.status === 'open' || c.status === 'notified',
          ).length,
        0,
      )
      const detail: ReportDetail = {
        id: report.id,
        reportNo: report.reportNo,
        status: row.status,
        department: report.department,
        version: row.version,
        versions: report.versions.map((v) => ({
          ...v,
          releasedByName: staffName(db, v.releasedBy),
          ...(v.requestedBy
            ? { requestedByName: staffName(db, v.requestedBy) }
            : {}),
        })),
        ...(report.pendingAmendment
          ? {
              pendingAmendment: {
                ...report.pendingAmendment,
                requestedByName: staffName(
                  db,
                  report.pendingAmendment.requestedBy,
                ),
              },
            }
          : {}),
        shareLog: report.shareLog.map((s) => ({
          ...s,
          byName: staffName(db, s.by),
        })),
        renotifyPending: Boolean(report.renotifyPending),
        printCount: report.printCount,
        patient: patientSummary(patient),
        order: {
          id: order.id,
          orderNo: order.orderNo,
          orderedAt: order.orderedAt,
          priority: order.priority,
          encounter: order.encounter,
          clinicalDepartment: order.department,
          clinicalNotes: order.clinicalNotes,
          doctor: doctorRef(db, order.doctorId),
          ...(order.ward ? { ward: order.ward } : {}),
          ...(order.bed ? { bed: order.bed } : {}),
          ...((patient.encounter.ipNumber ?? patient.encounter.visitNo)
            ? {
                visitNo:
                  patient.encounter.ipNumber ?? patient.encounter.visitNo,
              }
            : {}),
        },
        samples: [
          ...new Set(items.map((i) => i.sampleId).filter((s) => s !== null)),
        ].map((sid) => {
          const s = db.samples[sid]!
          return {
            id: s.id,
            accessionNo: s.accessionNo,
            specimen: s.specimen,
            container: s.container,
            status: s.status,
            ...(s.collectedAt ? { collectedAt: s.collectedAt } : {}),
            ...(s.receivedAt ? { receivedAt: s.receivedAt } : {}),
          }
        }),
        sections,
        pathologist: pathologistStaff
          ? {
              name: pathologistStaff.name,
              ...(pathologistStaff.qualification
                ? { qualification: pathologistStaff.qualification }
                : {}),
            }
          : null,
        enteredBy: [
          ...new Set(
            items
              .filter(isItemEntered)
              .map((i) => staffName(db, i.enteredBy))
              .filter(Boolean),
          ),
        ],
        reviewedBy: [
          ...new Set(
            items
              .filter((i) => i.reviewedBy)
              .map((i) => staffName(db, i.reviewedBy)),
          ),
        ],
        previousReports: Object.values(db.reports)
          .filter(
            (r) =>
              r.patientId === patient.id &&
              r.id !== report.id &&
              r.versions.length > 0,
          )
          .map((r) => ({
            id: r.id,
            reportNo: r.reportNo,
            department: r.department,
            status: reportRow(db, index, r).status,
            releasedAt: r.versions.at(-1)!.releasedAt,
          }))
          .toSorted((a, b) => (b.releasedAt ?? 0) - (a.releasedAt ?? 0))
          .slice(0, 8),
        openCriticals,
      }
      if (report.interpretation) detail.interpretation = report.interpretation
      const authorised = Math.max(0, ...items.map((i) => i.validatedAt ?? 0))
      if (authorised) detail.authorisedAt = authorised
      const released = report.versions.at(-1)?.releasedAt
      if (released) detail.reportedAt = released
      return detail
    }),

  release: (id: string, by: string) =>
    write((db, ctx) => void releaseReport(db, id, ctx), { by }),

  /** Asks for a correction; it takes effect when a pathologist authorises it. */
  requestCorrection: (id: string, request: CorrectionRequest, by: string) =>
    write((db, ctx) => void requestCorrection(db, id, request, ctx), { by }),

  authoriseCorrection: (id: string, by: string) =>
    write(
      (db, ctx) => {
        const report = authoriseCorrection(db, id, ctx)
        const newCriticals = Object.values(db.criticals).filter(
          (c) => c.detectedAt === ctx.now,
        )
        return {
          version: report.versions.at(-1)!.version,
          newCriticals: newCriticals.length,
        }
      },
      { by },
    ),

  declineCorrection: (id: string, reason: string, by: string) =>
    write((db, ctx) => void rejectCorrection(db, id, reason, ctx), { by }),

  /** Request and authorise in one step (a pathologist's own correction). */
  correct: (id: string, request: CorrectionRequest, by: string) =>
    write(
      (db, ctx) => {
        const report = correctReport(db, id, request, ctx)
        const newCriticals = Object.values(db.criticals).filter(
          (c) =>
            c.detectedAt === ctx.now &&
            request.corrections.some((x) => x.resultId === c.resultId),
        )
        return {
          version: report.versions.at(-1)!.version,
          newCriticals: newCriticals.length,
        }
      },
      { by },
    ),

  share: (id: string, input: { channel: ShareChannel; recipient: string }) =>
    write((db, ctx) => void shareReport(db, id, input, ctx)),

  recordPrint: (id: string) =>
    write((db, ctx) => void recordPrint(db, id, ctx)),

  setInterpretation: (id: string, text: string) =>
    write((db) => void setInterpretation(db, id, text)),
}
