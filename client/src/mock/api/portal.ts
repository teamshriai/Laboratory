// The patient-facing report page behind a share link. Demo only: the link
// is honoured in this browser. The backend will check the link (and later
// the patient's or doctor's login) before returning anything.

import { isReportReleased } from '@/domain/workflow'
import { LabApiError } from '../engine/core'
import { imagingDetail } from './imaging'
import { reportDetail } from './reports'
import { read } from './runtime'
import type { PublicReport } from './types'

export const portalApi = {
  report: (reportNo: string, options: { version?: number } = {}) =>
    read((db, { index }): PublicReport => {
      const link = db.reportLinks[reportNo.toUpperCase()]
      if (!link)
        throw new LabApiError('not-found', { entity: 'report', id: reportNo })
      if (link.kind === 'imaging') {
        const { shareLink: _link, ...report } = imagingDetail(
          db,
          link.targetId,
          options.version,
        )
        if (!report.viewing)
          throw new LabApiError('not-found', { entity: 'report', id: reportNo })
        return { kind: 'imaging', report }
      }
      const report = db.reports[link.targetId]
      // A withdrawn or no longer released report is not shown, link or not.
      if (!report || report.withdrawn || !isReportReleased(report))
        throw new LabApiError('not-found', { entity: 'report', id: reportNo })
      const {
        shareLog: _shareLog,
        pendingAmendment: _pending,
        previousReports: _previous,
        printCount: _printCount,
        renotifyPending: _renotify,
        shareLink: _link,
        ...publicView
      } = reportDetail(db, index, report.id, options.version)
      return { kind: 'laboratory', report: publicView }
    }, 'search'),
}
