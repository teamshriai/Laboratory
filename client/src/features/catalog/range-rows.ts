import type { ReferenceRange, SpecimenId } from '@/domain/types'
import { AGE_OPEN, sortRanges } from './catalog-helpers'

export interface RangeRow {
  key: string
  sex: ReferenceRange['sex']
  ageMin: string
  ageMax: string
  low: string
  high: string
  specimen: SpecimenId | 'any'
}

let rowSeq = 0
export const newRangeRow = (partial: Partial<RangeRow> = {}): RangeRow => ({
  key: `r${(rowSeq += 1)}`,
  sex: 'any',
  ageMin: '0',
  ageMax: '',
  low: '',
  high: '',
  specimen: 'any',
  ...partial,
})

export const rowsFromRanges = (ranges: ReferenceRange[]) =>
  sortRanges(ranges).map((r) =>
    newRangeRow({
      sex: r.sex,
      ageMin: String(r.ageMin),
      ageMax: r.ageMax >= AGE_OPEN ? '' : String(r.ageMax),
      low: r.low === null ? '' : String(r.low),
      high: r.high === null ? '' : String(r.high),
      specimen: r.specimen ?? 'any',
    }),
  )

export const num = (v: string) => (v.trim() === '' ? null : Number(v))

/** Converts rows to engine ranges; returns null when a row is invalid. */
export function rangesFromRows(rows: RangeRow[]) {
  const out: Omit<ReferenceRange, 'id' | 'analyteId'>[] = []
  for (const r of rows) {
    const ageMin = Number(r.ageMin || 0)
    const ageMax = r.ageMax.trim() === '' ? AGE_OPEN : Number(r.ageMax)
    const low = num(r.low)
    const high = num(r.high)
    if (
      !Number.isFinite(ageMin) ||
      !Number.isFinite(ageMax) ||
      ageMin >= ageMax
    )
      return null
    if (
      (low === null && high === null) ||
      (low !== null && !Number.isFinite(low)) ||
      (high !== null && !Number.isFinite(high))
    )
      return null
    if (low !== null && high !== null && low > high) return null
    out.push({
      sex: r.sex,
      ageMin,
      ageMax,
      low,
      high,
      ...(r.specimen !== 'any' ? { specimen: r.specimen } : {}),
    })
  }
  return out
}
