// Shared rules for what the printed sheet and the portal document add to a
// laboratory report: the NABL scope marker, the referral laboratory line and
// the plain-language summary for the patient.

import { useEffect, useState } from 'react'
import type { Flag, Language } from '@/domain/types'
import {
  isLoaded,
  loadLanguage,
  translate,
  translateEnum,
  type Namespace,
  type Params,
} from '@/i18n/core'
import type { PublicLabReport, ReportSection } from '@/services/lab-api'

type Row = ReportSection['rows'][number]

export const isAbnormalFlag = (flag: string | null | undefined) =>
  Boolean(flag && flag !== 'NORMAL' && flag !== 'NEGATIVE')

/** "Performed by <lab> (NABL <cert>)" for a test done by a referral lab. */
export function performedByText(
  lang: Language,
  by: NonNullable<ReportSection['performedBy']>,
) {
  // The lab is named with its city, as NABL 112A asks.
  const lab = by.city ? `${by.name}, ${by.city}` : by.name
  if (!by.nablAccredited)
    return translate(lang, 'reports', 'performedByNotAccredited', {
      lab,
    })
  if (by.certificateNo)
    return translate(lang, 'reports', 'performedByNabl', {
      lab,
      certificate: by.certificateNo,
    })
  return translate(lang, 'reports', 'performedByAccredited', { lab })
}

/**
 * The summary's languages: the patient's preferred language and English
 * when they differ, otherwise the document's language once.
 */
export function summaryLanguages(
  preferred: Language | undefined,
  documentLang: Language,
): Language[] {
  if (preferred && preferred !== 'en') return [preferred, 'en']
  return [preferred ?? documentLang]
}

const MEANING_KEY: Partial<Record<Flag, string>> = {
  HIGH: 'summaryHigher',
  CRITICAL_HIGH: 'summaryHigher',
  LOW: 'summaryLower',
  CRITICAL_LOW: 'summaryLower',
}

function valueIn(lang: Language, row: Row) {
  if (row.resultType !== 'posneg') return row.value ?? ''
  const style = row.posnegStyle ?? 'positive'
  const group =
    style === 'reactive'
      ? 'reactive'
      : style === 'detected'
        ? 'detected'
        : 'posneg'
  return translateEnum(
    lang,
    group,
    row.value === 'positive' ? 'positive' : 'negative',
  )
}

export interface SummaryLine {
  id: string
  test: string
  /** Value with its unit, in the given language. */
  value: (lang: Language) => string
  meaningKey: string
}

/** Released results outside their reference interval, in report order. */
export function summaryLines(
  report: Pick<PublicLabReport, 'sections'>,
  includeUnreleased: boolean,
): SummaryLine[] {
  return report.sections
    .filter((s) => includeUnreleased || s.released)
    .flatMap((s) => s.rows)
    .filter(
      (row) =>
        row.value &&
        row.resultType !== 'antibiogram' &&
        isAbnormalFlag(row.flag),
    )
    .map((row) => ({
      id: row.resultId,
      test: row.name,
      value: (lang) => [valueIn(lang, row), row.unit].filter(Boolean).join(' '),
      meaningKey: MEANING_KEY[row.flag as Flag] ?? 'summaryAbnormal',
    }))
}

/**
 * `translate` for languages other than the interface's: loads the ones not
 * yet loaded, and returns a new function once they arrive so what uses it
 * renders again.
 */
export function useTranslateIn(langs: Language[]) {
  const [loadedCount, setLoadedCount] = useState(0)
  const key = langs.join(',')
  useEffect(() => {
    const missing = (key.split(',') as Language[]).filter((l) => !isLoaded(l))
    if (!missing.length) return
    let cancelled = false
    Promise.all(missing.map((l) => loadLanguage(l))).then(
      () => {
        if (!cancelled) setLoadedCount((n) => n + 1)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [key])
  return (lang: Language, ns: Namespace, k: string, params?: Params) =>
    // `loadedCount` ties the function to the load, so callers re-render.
    loadedCount >= 0 ? translate(lang, ns, k, params) : k
}
