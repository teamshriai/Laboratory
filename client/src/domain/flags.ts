import type { Analyte, Flag, RangeSnapshot } from './types'

export interface ParsedNumeric {
  value: number
  qualifier: '<' | '>' | null
}

/** Parses "11.2", "8,400", "<0.5" or ">1000". Returns null if not numeric. */
export function parseNumeric(raw: string): ParsedNumeric | null {
  const text = raw.trim().replaceAll(',', '')
  const match = /^([<>])?\s*(-?\d+(?:\.\d+)?)$/.exec(text)
  if (!match) return null
  const value = Number(match[2])
  if (!Number.isFinite(value)) return null
  const q = match[1]
  return { value, qualifier: q === '<' || q === '>' ? q : null }
}

export function computeFlag(
  analyte: Pick<
    Analyte,
    'resultType' | 'normalOptions' | 'criticalIfAbnormal' | 'options'
  >,
  raw: string | null | undefined,
  range: RangeSnapshot | null,
): Flag | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null

  switch (analyte.resultType) {
    case 'numeric': {
      const parsed = parseNumeric(raw)
      if (!parsed) return null
      const { value, qualifier } = parsed
      // "<x" means somewhere below x, so it can never be high; ">x" can never
      // be low.
      const below = (bound: number) =>
        qualifier === '>'
          ? false
          : qualifier === '<'
            ? value <= bound
            : value < bound
      const above = (bound: number) =>
        qualifier === '<'
          ? false
          : qualifier === '>'
            ? value >= bound
            : value > bound
      if (range?.criticalLow !== undefined && below(range.criticalLow))
        return 'CRITICAL_LOW'
      if (range?.criticalHigh !== undefined && above(range.criticalHigh))
        return 'CRITICAL_HIGH'
      if (!range || (range.low === null && range.high === null)) return null
      if (range.low !== null && below(range.low)) return 'LOW'
      if (range.high !== null && above(range.high)) return 'HIGH'
      return 'NORMAL'
    }
    case 'posneg':
      if (raw === 'positive') return 'POSITIVE'
      if (raw === 'negative') return 'NEGATIVE'
      return null
    case 'select': {
      if (!analyte.normalOptions || analyte.normalOptions.length === 0)
        return null
      if (analyte.normalOptions.includes(raw)) return 'NORMAL'
      return analyte.criticalIfAbnormal ? 'POSITIVE' : 'ABNORMAL'
    }
    default:
      return null
  }
}

export function isAbnormal(flag: Flag | null | undefined) {
  return (
    flag !== null &&
    flag !== undefined &&
    flag !== 'NORMAL' &&
    flag !== 'NEGATIVE'
  )
}

export function isCriticalFlag(
  analyte: Pick<Analyte, 'criticalIfAbnormal'>,
  flag: Flag | null | undefined,
) {
  if (flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH') return true
  return Boolean(
    analyte.criticalIfAbnormal && (flag === 'POSITIVE' || flag === 'ABNORMAL'),
  )
}

export interface DeltaCheck {
  deltaPct: number
  exceeded: boolean
}

/** Percentage change versus the previous numeric result, if both exist. */
export function deltaCheck(
  current: string | null,
  previous: string | null | undefined,
  thresholdPct: number | undefined,
): DeltaCheck | null {
  if (!current || !previous) return null
  const a = parseNumeric(current)
  const b = parseNumeric(previous)
  if (!a || !b || b.value === 0) return null
  const deltaPct = ((a.value - b.value) / Math.abs(b.value)) * 100
  return {
    deltaPct,
    exceeded: thresholdPct !== undefined && Math.abs(deltaPct) > thresholdPct,
  }
}

/** Severity order used to sort results (most urgent first). */
export function flagSeverity(flag: Flag | null | undefined) {
  switch (flag) {
    case 'CRITICAL_LOW':
    case 'CRITICAL_HIGH':
      return 3
    case 'POSITIVE':
    case 'ABNORMAL':
    case 'LOW':
    case 'HIGH':
      return 2
    case 'NORMAL':
    case 'NEGATIVE':
      return 1
    default:
      return 0
  }
}

/** Whether an analyte needs a value, given the other values in the same test. */
export function isAnalyteRequired(
  analyte: Analyte,
  values: Record<string, string | null | undefined>,
  analytes: Record<string, Analyte>,
) {
  if (!analyte.dependsOn) return true
  const parent = analytes[analyte.dependsOn]
  const parentValue = values[analyte.dependsOn]
  if (!parent || !parentValue) return false
  return isAbnormal(computeFlag(parent, parentValue, null))
}
