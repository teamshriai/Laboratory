import type { DepartmentId } from '@/domain/types'
import type { CSSProperties } from 'react'

export const ICON_TONES = [
  'teal',
  'blue',
  'indigo',
  'violet',
  'rose',
  'red',
  'orange',
  'amber',
  'green',
  'sky',
  'slate',
] as const
export type IconTone = (typeof ICON_TONES)[number]

/** Status meanings map onto icon hues so a tile can follow a state. */
export const STATUS_TONE = {
  accent: 'blue',
  success: 'green',
  warning: 'amber',
  danger: 'red',
  info: 'blue',
  neutral: 'slate',
} as const satisfies Record<string, IconTone>

export function toneStyle(tone: IconTone): CSSProperties {
  return { '--tone': `var(--ic-${tone})` } as CSSProperties
}

/** Destination hue per screen (design system 4.4 tier 2): the sidebar tile,
 * section headings and quick-link tiles share it. */
export const NAV_TONES = {
  overview: 'blue',
  workQueue: 'violet',
  patients: 'green',
  orders: 'orange',
  collection: 'rose',
  processing: 'teal',
  results: 'amber',
  validation: 'sky',
  reports: 'indigo',
  inventory: 'orange',
  reagents: 'violet',
  consumables: 'orange',
  equipment: 'sky',
  qualityControl: 'green',
  criticalValues: 'red',
  tat: 'amber',
  analytics: 'indigo',
  testCatalog: 'teal',
  users: 'sky',
  auditLog: 'indigo',
  imaging: 'sky',
  imagingCt: 'teal',
  imagingMri: 'violet',
  imagingXray: 'amber',
  settings: 'violet',
  billing: 'green',
  homeCollection: 'rose',
  messages: 'sky',
  referrers: 'teal',
  myPatients: 'blue',
  quality: 'amber',
  coldStorage: 'sky',
  registers: 'indigo',
  privacy: 'violet',
  interfaces: 'teal',
} as const satisfies Record<string, IconTone>

export const DEPARTMENT_TONES: Record<DepartmentId, IconTone> = {
  hematology: 'rose',
  biochemistry: 'amber',
  'clinical-pathology': 'orange',
  microbiology: 'green',
  immunology: 'indigo',
  serology: 'violet',
  histopathology: 'sky',
  cytology: 'blue',
}
