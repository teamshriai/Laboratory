import { useCallback } from 'react'
import { useEnum, useT } from '@/i18n/context'
import type { TKey } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import type { DepartmentId } from '@/domain/types'

const PREFIX = 'coldStorage.'

/**
 * Form error text for the cold storage and qualification forms:
 * "coldStorage.x" keys come from this namespace; Field itself resolves
 * "forms." and "errors.".
 */
export function useColdText() {
  const t = useT('coldStorage')
  return useCallback(
    (message: string | undefined) =>
      message?.startsWith(PREFIX)
        ? t(message.slice(PREFIX.length) as TKey<'coldStorage'>)
        : message,
    [t],
  )
}

/** Temperatures and allowed ranges in the reader's number format. */
export function useTemperature() {
  const t = useT('coldStorage')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  // A true minus sign keeps "-86 - -70" readable next to the range hyphen.
  const num = (n: number) => f.decimal(n).replace('-', '\u2212')
  return {
    number: num,
    temp: (value: number) => t('temp', { value: num(value) }),
    range: (min: number, max: number) =>
      t('range', { min: num(min), max: num(max) }),
    department: (d: DepartmentId | 'all') =>
      d === 'all' ? tc('allDepartments') : e('department', d),
  }
}

/** A typed number from a text field ("," accepted as the decimal mark). */
export function parseNumber(text: string) {
  const trimmed = text.trim().replace(',', '.').replace('−', '-')
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** The engine's plausibility limits for a temperature, in °C. */
export const TEMPERATURE_LIMITS = { min: -100, max: 100 } as const
