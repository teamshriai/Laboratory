import type {
  Analyte,
  RangeSnapshot,
  ReferenceRange,
  Sex,
  SpecimenId,
} from './types'

interface RangeContext {
  sex: Sex
  ageYears: number
  specimen?: SpecimenId
}

/**
 * Picks the most specific reference range for a patient: a matching sex beats
 * "any", a matching specimen beats a generic range, a narrower age band beats
 * a wider one.
 */
export function pickRange(
  ranges: ReferenceRange[],
  ctx: RangeContext,
): ReferenceRange | null {
  let best: ReferenceRange | null = null
  let bestScore = -Infinity
  for (const r of ranges) {
    if (r.sex !== 'any' && r.sex !== ctx.sex) continue
    if (ctx.ageYears < r.ageMin || ctx.ageYears >= r.ageMax) continue
    if (r.specimen && ctx.specimen && r.specimen !== ctx.specimen) continue
    const score =
      (r.sex === 'any' ? 0 : 100) +
      (r.specimen ? 50 : 0) -
      Math.min(r.ageMax - r.ageMin, 200) / 10
    if (score > bestScore) {
      best = r
      bestScore = score
    }
  }
  return best
}

export function rangeSnapshot(
  analyte: Pick<Analyte, 'criticalLow' | 'criticalHigh'>,
  range: ReferenceRange | null,
): RangeSnapshot | null {
  if (
    !range &&
    analyte.criticalLow === undefined &&
    analyte.criticalHigh === undefined
  )
    return null
  const snap: RangeSnapshot = {
    low: range?.low ?? null,
    high: range?.high ?? null,
  }
  if (analyte.criticalLow !== undefined) snap.criticalLow = analyte.criticalLow
  if (analyte.criticalHigh !== undefined)
    snap.criticalHigh = analyte.criticalHigh
  return snap
}

function fixed(n: number, decimals: number | undefined) {
  return decimals === undefined ? String(n) : n.toFixed(decimals)
}

/** "13.0 - 17.0", "< 200", "> 40", or null when there is no numeric range. */
export function formatRange(
  range: Pick<RangeSnapshot, 'low' | 'high'> | null | undefined,
  decimals?: number,
): string | null {
  if (!range) return null
  const { low, high } = range
  if (low !== null && high !== null)
    return `${fixed(low, decimals)} - ${fixed(high, decimals)}`
  if (high !== null) return `< ${fixed(high, decimals)}`
  if (low !== null) return `> ${fixed(low, decimals)}`
  return null
}

/** Critical limits as display parts, e.g. ["< 7", "> 20"]; join them in the UI. */
export function criticalRangeParts(
  range: Pick<RangeSnapshot, 'criticalLow' | 'criticalHigh'> | null | undefined,
): string[] {
  if (!range) return []
  const parts: string[] = []
  if (range.criticalLow !== undefined) parts.push(`< ${range.criticalLow}`)
  if (range.criticalHigh !== undefined) parts.push(`> ${range.criticalHigh}`)
  return parts
}
