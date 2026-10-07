import {
  CALCULATED_FROM,
  computeCalculated,
  type CalculatedValue,
} from '@/domain/calculated'
import { computeFlag, isAnalyteRequired, isCriticalFlag } from '@/domain/flags'
import type { Analyte, Flag, RangeSnapshot } from '@/domain/types'
import { useT } from '@/i18n/context'
import type { EntryItem } from '@/services/lab-api'

export type ItemValues = Record<string, { value: string; remarks: string }>
/** itemId -> analyte id -> what is in the form. */
export type Values = Record<string, ItemValues>

export interface LiveItem {
  /** analyte id -> value as it will be saved (calculated ones computed). */
  plain: Record<string, string>
  /** The calculated analytes of the test and what the system computes. */
  calculated: Record<string, CalculatedValue>
}

/**
 * The test's values as the engine will store them: measured values as
 * typed, calculated ones computed from them (domain/calculated.ts).
 */
export function liveItem(
  item: EntryItem,
  values: ItemValues | undefined,
): LiveItem {
  const plain: Record<string, string> = {}
  const decimals: Record<string, number> = {}
  for (const a of item.analytes) {
    plain[a.analyte.id] = values?.[a.analyte.id]?.value ?? ''
    decimals[a.analyte.id] = a.analyte.decimals ?? 0
  }
  const calculated = computeCalculated(
    item.analytes.map((a) => a.analyte.id),
    plain,
    (id) => decimals[id] ?? 0,
  )
  for (const [id, c] of Object.entries(calculated)) plain[id] = c.value ?? ''
  return { plain, calculated }
}

/** Names of the measured analytes a calculated one comes from. */
export function calculatedInputs(item: EntryItem, analyteId: string) {
  return (CALCULATED_FROM[analyteId] ?? [])
    .map((id) => item.analytes.find((a) => a.analyte.id === id)?.analyte.name)
    .filter((n): n is string => Boolean(n))
}

export interface LiveRow {
  analyte: Analyte
  range: RangeSnapshot | null
  value: string
  flag: Flag | null
  critical: boolean
  required: boolean
  calculated: CalculatedValue | undefined
}

/** Every analyte of the test with its live value and flag. */
export function liveRows(
  item: EntryItem,
  live: LiveItem,
  analytes: Record<string, Analyte>,
): LiveRow[] {
  return item.analytes.map(({ analyte, range }) => {
    const value = live.plain[analyte.id] ?? ''
    const flag = computeFlag(analyte, value, range)
    return {
      analyte,
      range,
      value,
      flag,
      critical: isCriticalFlag(analyte, flag),
      required: isAnalyteRequired(analyte, live.plain, analytes),
      calculated: live.calculated[analyte.id],
    }
  })
}

/** "NABL MC-1234", "NABL accredited" or "not NABL accredited". */
export function useAccreditation() {
  const t = useT('results')
  return (performedBy: NonNullable<EntryItem['performedBy']>) =>
    performedBy.nablAccredited
      ? performedBy.certificateNo
        ? t('nablCertificate', { cert: performedBy.certificateNo })
        : t('nablAccredited')
      : t('notNabl')
}
