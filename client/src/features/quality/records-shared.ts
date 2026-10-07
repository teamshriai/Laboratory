// Helpers shared by the quality records panels (documents, internal audits,
// LIS verification and measurement uncertainty).

import { useCallback } from 'react'
import type { DepartmentId, DocumentState } from '@/domain/types'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { translate, type TKey } from '@/i18n/core'

/** URL keys for the record open in each panel's drawer. */
export const DOC_PARAM = 'doc'
export const AUDIT_PARAM = 'audit'
export const LIS_PARAM = 'lis'

/** A department, or the whole laboratory for lab-wide records. */
export function useDepartmentLabel() {
  const e = useEnum()
  const t = useT('qualityRecords')
  return useCallback(
    (d: DepartmentId | 'all') =>
      d === 'all' ? t('wholeLab') : e('department', d),
    [e, t],
  )
}

/**
 * Resolves "qualityRecords.xxx" form error keys; "forms." and "errors." keys
 * and plain text pass through to Field.
 */
export function useRecordsMessage() {
  const { language } = useLanguage()
  return useCallback(
    (message: string | undefined) =>
      message?.startsWith('qualityRecords.')
        ? translate(
            language,
            'qualityRecords',
            message.slice(15) as TKey<'qualityRecords'>,
          )
        : message,
    [language],
  )
}

/** A fixed number of decimals, in the UI language's digits and separators. */
export function formatFixed(locale: string, value: number, digits: number) {
  return new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** Up to `digits` decimals, trailing zeros dropped. */
export function formatUpTo(locale: string, value: number, digits: number) {
  return new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    maximumFractionDigits: digits,
  }).format(value)
}

/** A signed percentage, e.g. "+1.2" or "-0.4". */
export function formatSigned(locale: string, value: number, digits = 1) {
  return new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(value)
}

/** A date input value (YYYY-MM-DD) as 10:00 IST that day. */
export function dateInputToMs(value: string) {
  return Date.parse(`${value}T10:00:00+05:30`)
}

/** Review falls due within this many days: flagged as due soon. */
export const DUE_SOON_DAYS = 30

/** The document's overall state: in force if any version is. */
export function documentState(doc: {
  current?: { state: DocumentState }
  versions: { state: DocumentState }[]
}): DocumentState {
  if (doc.current) return 'approved'
  return doc.versions.at(-1)?.state ?? 'draft'
}
