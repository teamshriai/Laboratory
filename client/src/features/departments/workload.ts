import { DEPARTMENTS, type DepartmentId } from '@/domain/types'
import type { TKey } from '@/i18n/core'
import type { DepartmentSummary } from '@/services/lab-api'

type SeriesKey = 'pending' | 'processing' | 'awaitingValidation' | 'completed'

/**
 * Workflow stages shown in the department strips, left to right. Pending,
 * in lab and completed keep the colours used on the dashboard workload chart.
 */
export const WORK_SERIES: readonly {
  key: SeriesKey
  label: TKey<'departments'>
  swatch: string
}[] = [
  { key: 'pending', label: 'seriesPending', swatch: 'bg-chart-2' },
  { key: 'processing', label: 'seriesInLab', swatch: 'bg-chart-3' },
  { key: 'awaitingValidation', label: 'seriesAwaiting', swatch: 'bg-chart-4' },
  { key: 'completed', label: 'seriesCompleted', swatch: 'bg-chart-1' },
]

export type WorkCounts = Pick<DepartmentSummary, SeriesKey>

export function workTotal(counts: WorkCounts) {
  return WORK_SERIES.reduce((n, s) => n + counts[s.key], 0)
}

export function isDepartmentId(
  value: string | undefined,
): value is DepartmentId {
  return (
    value !== undefined && (DEPARTMENTS as readonly string[]).includes(value)
  )
}

/** On-time share below this (in percent) is called out. */
export const TAT_TARGET_PCT = 90
