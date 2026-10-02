import type { ImagingStatus, ImagingStudy } from './types'

/** Where a study stands, derived from what has happened to it. */
export function imagingStatus(study: ImagingStudy): ImagingStatus {
  const latest = study.versions.at(-1)
  if (latest) {
    if (latest.kind === 'amended') return 'amended'
    if (latest.kind === 'final') return 'final'
    return 'reported'
  }
  return study.performedAt === undefined ? 'scheduled' : 'acquired'
}

/** Issued (and so viewable and shareable) once any version exists. */
export const isImagingReported = (study: ImagingStudy) =>
  study.versions.length > 0
