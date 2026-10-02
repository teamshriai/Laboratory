import type { Modality } from '@/domain/types'
import type { NavKey } from '@/app/layout/nav-config'

/** Where each modality's worklist lives. */
export const MODALITY_PATH: Record<Modality, string> = {
  ct: '/imaging/ct',
  mri: '/imaging/mri',
  xray: '/imaging/x-ray',
}

export const MODALITY_NAV: Record<Modality, NavKey> = {
  ct: 'imagingCt',
  mri: 'imagingMri',
  xray: 'imagingXray',
}

export function modalityFromPath(pathname: string): Modality {
  if (pathname.endsWith('/mri')) return 'mri'
  if (pathname.endsWith('/x-ray')) return 'xray'
  return 'ct'
}
