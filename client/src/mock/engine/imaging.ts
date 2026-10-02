import { isImagingReported } from '@/domain/imaging'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

/**
 * Share link for an issued imaging report (demo; see createReportLink).
 * Imaging is otherwise read-only here: acquisition and reporting happen in
 * the RIS/PACS, which the backend will connect.
 */
export function createImagingLink(db: LabDb, studyId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'report.share')
  const study = must(db.imaging, studyId, 'imaging')
  if (!isImagingReported(study) || !study.reportNo)
    throw new LabApiError('report-not-released')
  const version = study.versions.at(-1)!.version
  db.reportLinks[study.reportNo] = {
    reportNo: study.reportNo,
    kind: 'imaging',
    targetId: study.id,
    createdAt: ctx.now,
    createdBy: ctx.by,
    version,
  }
  audit(db, ctx, 'imaging', study.id, 'link-created', {
    detail: { report: study.reportNo, version },
  })
  return db.reportLinks[study.reportNo]!
}
