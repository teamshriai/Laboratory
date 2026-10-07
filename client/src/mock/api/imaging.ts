// Diagnostic imaging (CT, MRI, X-ray): worklists, the imaging dashboard and
// report views. Read-only apart from share links; scheduling, acquisition
// and reporting will come from the RIS/PACS through the backend.

import { imagingStatus } from '@/domain/imaging'
import { startOfIstDay } from '@/domain/time'
import { MODALITIES, type ImagingStudy } from '@/domain/types'
import type { LabDb } from '../db/schema'
import { must } from '../engine/core'
import { createShareLink, revokeShareLink } from '../engine/share'
import { shareLinkRow, shareLinksOf } from './share'
import { read, write } from './runtime'
import type {
  CreatedShareLink,
  ImagingFilters,
  ImagingOverview,
  ImagingReportDetail,
  ImagingRow,
} from './types'
import {
  doctorRef,
  matchesQuery,
  patientSearchFields,
  patientSummary,
} from './views'

const PRIORITY_RANK = { stat: 0, urgent: 1, routine: 2 } as const

export function imagingRow(db: LabDb, study: ImagingStudy): ImagingRow {
  const patient = db.patients[study.patientId]!
  const latest = study.versions.at(-1)
  const row: ImagingRow = {
    id: study.id,
    accessionNo: study.accessionNo,
    patient: patientSummary(patient),
    doctorName: db.doctors[study.orderingDoctorId]?.name ?? '',
    modality: study.modality,
    examName: study.examName,
    bodyRegion: study.bodyRegion,
    priority: study.priority,
    status: imagingStatus(study),
    scheduledAt: study.scheduledAt,
    version: latest?.version ?? 0,
  }
  if (study.reportNo) row.reportNo = study.reportNo
  if (study.performedAt !== undefined) row.performedAt = study.performedAt
  if (latest) row.reportedAt = latest.releasedAt
  return row
}

/** The report as issued; `version` shows an earlier one unchanged. */
export function imagingDetail(
  db: LabDb,
  id: string,
  version: number | undefined,
  now: number,
): ImagingReportDetail {
  const study = must(db.imaging, id, 'imaging')
  const latest = study.versions.at(-1)
  const viewing =
    version !== undefined
      ? (study.versions.find((v) => v.version === version) ?? latest)
      : latest
  const detail: ImagingReportDetail = {
    ...imagingRow(db, study),
    shareLinks: shareLinksOf(db, 'imaging', study.id, now),
    indication: study.indication,
    doctor: doctorRef(db, study.orderingDoctorId),
    versions: study.versions.map((v) => ({
      version: v.version,
      kind: v.kind,
      releasedAt: v.releasedAt,
      reportedBy: v.reportedBy.name,
      ...(v.amendmentReason ? { amendmentReason: v.amendmentReason } : {}),
    })),
  }
  if (study.contrast) detail.contrast = study.contrast
  if (viewing?.digest && viewing.verifyToken)
    detail.seal = { digest: viewing.digest, verifyToken: viewing.verifyToken }
  if (viewing) {
    detail.viewing = viewing
    if (latest && viewing.version !== latest.version) {
      detail.supersededBy = latest.version
      detail.reportedAt = viewing.releasedAt
      detail.version = viewing.version
      detail.status =
        viewing.kind === 'amended'
          ? 'amended'
          : viewing.kind === 'final'
            ? 'final'
            : 'reported'
    }
  }
  return detail
}

/** Waiting longest first; STAT ahead of urgent ahead of routine. */
const byUrgency = (a: ImagingRow, b: ImagingRow) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
  (a.performedAt ?? a.scheduledAt) - (b.performedAt ?? b.scheduledAt)

export function imagingRows(db: LabDb) {
  return Object.values(db.imaging).map((s) => imagingRow(db, s))
}

export const imagingApi = {
  overview: () =>
    read((db, { now }): ImagingOverview => {
      const rows = imagingRows(db)
      const today = startOfIstDay(now)
      const awaiting = rows
        .filter((r) => r.status === 'acquired')
        .toSorted(byUrgency)
      const recent = (list: ImagingRow[]) =>
        list
          .toSorted(
            (a, b) =>
              (b.reportedAt ?? b.performedAt ?? b.scheduledAt) -
              (a.reportedAt ?? a.performedAt ?? a.scheduledAt),
          )
          .slice(0, 4)
      return {
        counts: {
          today: rows.filter((r) => (r.performedAt ?? r.scheduledAt) >= today)
            .length,
          awaitingReport: awaiting.length,
          reportedToday: rows.filter((r) => (r.reportedAt ?? 0) >= today)
            .length,
          scheduled: rows.filter((r) => r.status === 'scheduled').length,
          amended: rows.filter((r) => r.status === 'amended').length,
        },
        awaiting,
        modalities: MODALITIES.map((modality) => {
          const mine = rows.filter((r) => r.modality === modality)
          return {
            modality,
            total: mine.length,
            awaitingReport: mine.filter((r) => r.status === 'acquired').length,
            scheduled: mine.filter((r) => r.status === 'scheduled').length,
            recent: recent(mine),
          }
        }),
      }
    }),

  list: (filters: ImagingFilters = {}) =>
    read((db): ImagingRow[] =>
      imagingRows(db)
        .filter((r) => !filters.modality || r.modality === filters.modality)
        .filter(
          (r) =>
            !filters.status ||
            filters.status === 'all' ||
            r.status === filters.status,
        )
        .filter((r) =>
          matchesQuery(filters.q, [
            ...patientSearchFields(db.patients[r.patient.id]!),
            r.accessionNo,
            r.reportNo,
            r.examName,
            r.bodyRegion,
          ]),
        )
        .toSorted(
          (a, b) =>
            // Work still to do first, then the newest reports.
            Number(a.version > 0) - Number(b.version > 0) ||
            (a.version === 0
              ? byUrgency(a, b)
              : (b.reportedAt ?? 0) - (a.reportedAt ?? 0)),
        ),
    ),

  report: (id: string, options: { version?: number } = {}) =>
    read((db, { now }) => imagingDetail(db, id, options.version, now)),

  /** A new share link; the token is returned once to build the URL. */
  createShareLink: (id: string, input: { days?: number } = {}) =>
    write((db, ctx): CreatedShareLink => {
      const { link, token } = createShareLink(
        db,
        { kind: 'imaging', id },
        input,
        ctx,
      )
      return { token, link: shareLinkRow(db, link, ctx.now) }
    }),

  revokeShareLink: (linkId: string) =>
    write((db, ctx) => void revokeShareLink(db, linkId, ctx)),
}
