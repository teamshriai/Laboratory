// The public pages: a report behind a share link (after the patient's date
// of birth), and the verification page behind a report's QR code. Neither
// needs a login; both show only what the link or code entitles. A backend
// rate-limits these routes and logs every attempt.

import { LabApiError } from '../engine/core'
import { attemptShareLink } from '../engine/share'
import { imagingDetail } from './imaging'
import { reportDetail } from './reports'
import { read, write } from './runtime'
import type { PublicLab, PublicReport, VerificationView } from './types'
import type { LabDb } from '../db/schema'
import { getIndex } from './index-cache'

/** Staff-only parts of a report never reach the public page. */
function publicLabReport(
  report: ReturnType<typeof reportDetail>,
): Extract<PublicReport, { kind: 'laboratory' }>['report'] {
  const {
    shareLog: _shareLog,
    pendingAmendment: _pending,
    previousReports: _previous,
    printCount: _printCount,
    renotifyPending: _renotify,
    shareLinks: _links,
    ...publicView
  } = report
  return publicView
}

function publicLab(db: LabDb): PublicLab {
  const s = db.settings
  return {
    labName: s.labName,
    labAddress: s.labAddress,
    labRegistration: s.labRegistration,
    labAccreditation: s.labAccreditation,
    reportHeader: s.reportHeader,
    reportFooter: s.reportFooter,
    patientSummaryOnReport: s.patientSummaryOnReport,
  }
}

export const portalApi = {
  /**
   * Opens a shared report: the link must be active and the date of birth
   * (YYYY-MM-DD) must match the patient's. Wrong answers count towards a
   * lock; every attempt is logged on the link.
   */
  open: async (token: string, input: { dob: string }) => {
    // The attempt is saved first (a refusal included), then reported.
    const outcome = await write((db, ctx) =>
      attemptShareLink(db, token, input.dob, ctx.now),
    )
    if (!outcome.ok) throw new LabApiError(outcome.code, outcome.params)
    const { link } = outcome
    return read((db, { now }): PublicReport => {
      if (link.kind === 'imaging') {
        const { shareLinks: _links, ...report } = imagingDetail(
          db,
          link.targetId,
          link.version,
          now,
        )
        if (!report.viewing) throw new LabApiError('link-not-found')
        return { kind: 'imaging', report, lab: publicLab(db) }
      }
      const report = db.reports[link.targetId]
      if (!report || report.withdrawn) throw new LabApiError('link-revoked')
      return {
        kind: 'laboratory',
        report: publicLabReport(
          reportDetail(db, getIndex(db), report.id, link.version, now),
        ),
        lab: publicLab(db),
      }
    })
  },

  /** The QR code's page: genuine or not, which version, no patient data. */
  verify: (token: string) =>
    read((db): VerificationView => {
      const v = db.verifications[token.trim()]
      if (!v) throw new LabApiError('link-not-found')
      let status: VerificationView['status'] = 'current'
      if (v.kind === 'laboratory') {
        const report = db.reports[v.targetId]
        if (!report) throw new LabApiError('link-not-found')
        if (report.withdrawn) status = 'withdrawn'
        else if ((report.versions.at(-1)?.version ?? 0) > v.version)
          status = 'superseded'
      } else {
        const study = db.imaging[v.targetId]
        if (!study) throw new LabApiError('link-not-found')
        if ((study.versions.at(-1)?.version ?? 0) > v.version)
          status = 'superseded'
      }
      return {
        kind: v.kind,
        reportNo: v.reportNo,
        version: v.version,
        issuedAt: v.issuedAt,
        digest: v.digest,
        status,
        labName: db.settings.labName,
        labAccreditation: db.settings.labAccreditation,
      }
    }, 'search'),
}
