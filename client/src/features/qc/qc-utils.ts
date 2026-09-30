import { evaluateQc, type QcEvaluation } from '@/domain/qc'
import type { QcLevel, QcResult } from '@/domain/types'
import type { QcView } from '@/services/lab-api'

export type QcSeries = QcView['series'][number]
export type QcPoint = QcSeries['points'][number]

export function seriesKey(s: {
  equipmentId: string
  analyteId: string
  level: QcLevel
}) {
  return `${s.equipmentId}|${s.analyteId}|${s.level}`
}

const RESULT_RANK: Record<QcResult, number> = { fail: 0, warning: 1, pass: 2 }

/** Analyzer, then analyte, then level: a stable order for pickers and lists. */
export function sortSeries(series: QcSeries[]) {
  return series.toSorted(
    (a, b) =>
      a.equipmentName.localeCompare(b.equipmentName) ||
      a.analyteName.localeCompare(b.analyteName) ||
      a.level.localeCompare(b.level),
  )
}

/** The series that most needs attention: latest failure, then warning, then the first. */
export function defaultSeriesKey(series: QcSeries[]) {
  const worst = series.toSorted(
    (a, b) => RESULT_RANK[a.last] - RESULT_RANK[b.last],
  )[0]
  return worst ? seriesKey(worst) : null
}

export function groupByAnalyzer(series: QcSeries[]) {
  const groups = new Map<
    string,
    { equipmentId: string; equipmentName: string; series: QcSeries[] }
  >()
  for (const s of series) {
    const group = groups.get(s.equipmentId) ?? {
      equipmentId: s.equipmentId,
      equipmentName: s.equipmentName,
      series: [],
    }
    group.series.push(s)
    groups.set(s.equipmentId, group)
  }
  return [...groups.values()]
}

function decimalsOf(n: number) {
  const text = String(n)
  const dot = text.indexOf('.')
  return dot === -1 ? 0 : Math.min(3, text.length - dot - 1)
}

/** Decimal places that show a control's mean and SD without rounding them away. */
export function qcDigits(mean: number, sd: number) {
  return Math.max(decimalsOf(mean), decimalsOf(sd))
}

const formatters = new Map<string, Intl.NumberFormat>()

export function formatFixed(locale: string, value: number, digits: number) {
  const id = `${locale}|${digits}`
  let fmt = formatters.get(id)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      numberingSystem: 'latn',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    formatters.set(id, fmt)
  }
  return fmt.format(value)
}

/** Signed z-score, e.g. "+2.14" or "-0.35". */
export function formatZ(z: number) {
  const rounded = Math.round(z * 100) / 100
  return `${rounded > 0 ? '+' : rounded < 0 ? '-' : ''}${Math.abs(rounded).toFixed(2)}`
}

export function zTone(z: number) {
  const abs = Math.abs(z)
  if (abs > 3) return 'text-danger-text'
  if (abs > 2) return 'text-warning-text'
  return 'text-fg-muted'
}

/** Westgard evaluation a new value would get, using the same rules as the engine. */
export function previewEvaluation(
  series: QcSeries,
  value: number,
): QcEvaluation {
  const previousZ = series.points
    .toReversed()
    .slice(0, 3)
    .map((p) => p.z)
  return evaluateQc(value, series.mean, series.sd, previousZ)
}

export const QC_RESULT_FILTERS = ['all', 'pass', 'warning', 'fail'] as const
export type QcResultFilter = (typeof QC_RESULT_FILTERS)[number]

export function parseResultFilter(value: string | null): QcResultFilter {
  return (QC_RESULT_FILTERS as readonly string[]).includes(value ?? '')
    ? (value as QcResultFilter)
    : 'all'
}
