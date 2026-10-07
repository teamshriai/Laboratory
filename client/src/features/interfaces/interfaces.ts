// Shared lists and helpers for the Interfaces screen.

import { INTERFACE_DIRECTIONS, INTERFACE_STATES } from '@/domain/types'
import type { InterfaceOverview } from '@/services/lab-api'

export const INTERFACE_TABS = [
  'monitor',
  'messages',
  'mappings',
  'coding',
] as const
export type InterfaceTab = (typeof INTERFACE_TABS)[number]

export const STATE_FILTERS = ['all', ...INTERFACE_STATES] as const
export const DIRECTION_FILTERS = ['all', ...INTERFACE_DIRECTIONS] as const

/** The coding table's filter: everything, or what still lacks a code. */
export const CODING_FILTERS = ['all', 'missing-loinc', 'missing-ucum'] as const
export type CodingFilter = (typeof CODING_FILTERS)[number]

/** A link to a tab of this screen, optionally narrowed. */
export function interfacesHref(
  tab: InterfaceTab,
  params: Record<string, string> = {},
) {
  const search = new URLSearchParams(params)
  if (tab !== 'monitor') search.set('tab', tab)
  const text = search.toString()
  return text ? `/interfaces?${text}` : '/interfaces'
}

/** Whole percent of `part` in `total` (0 when there is nothing to count). */
export const percentOf = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0

/** What to prefill when a mapping dialog opens. */
export interface MappingDraft {
  equipmentId?: string
  instrumentCode?: string
  analyteId?: string
  /** Changing an existing mapping keeps its analyser and code. */
  existing?: InterfaceOverview['mappings'][number]
}
