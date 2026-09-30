import { useMemo } from 'react'
import type { Language } from '@/domain/types'
import { HOUR, MINUTE } from '@/domain/time'
import { useLanguage } from './context'
import { INTL_LOCALE, translate } from './core'

const TZ = 'Asia/Kolkata'

export function createFormatter(lang: Language) {
  const locale = INTL_LOCALE[lang]
  const opts = { timeZone: TZ, numberingSystem: 'latn' } as const
  const date = new Intl.DateTimeFormat(locale, {
    ...opts,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const dateShort = new Intl.DateTimeFormat(locale, {
    ...opts,
    day: '2-digit',
    month: 'short',
  })
  const time = new Intl.DateTimeFormat(locale, {
    ...opts,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const dateTime = new Intl.DateTimeFormat(locale, {
    ...opts,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const weekday = new Intl.DateTimeFormat(locale, {
    ...opts,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const number = new Intl.NumberFormat(locale, { numberingSystem: 'latn' })
  const decimal = new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    maximumFractionDigits: 1,
  })
  const currency = new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })
  const compactCurrency = new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const percent = new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    style: 'percent',
    maximumFractionDigits: 1,
  })
  const relative = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
    style: 'short',
  })

  const duration = (ms: number) => {
    const total = Math.max(0, Math.round(ms / MINUTE))
    const h = Math.floor(total / 60)
    const m = total % 60
    if (h >= 48)
      return translate(lang, 'common', 'durationDays', {
        d: Math.floor(h / 24),
        h: h % 24,
      })
    if (h === 0) return translate(lang, 'common', 'durationM', { m })
    if (m === 0) return translate(lang, 'common', 'durationH', { h })
    return translate(lang, 'common', 'durationHM', { h, m })
  }

  return {
    locale,
    date: (ms: number) => date.format(ms),
    dateShort: (ms: number) => dateShort.format(ms),
    time: (ms: number) => time.format(ms),
    dateTime: (ms: number) => dateTime.format(ms),
    weekday: (ms: number) => weekday.format(ms),
    number: (n: number) => number.format(n),
    decimal: (n: number) => decimal.format(n),
    currency: (n: number) => currency.format(n),
    compactCurrency: (n: number) => compactCurrency.format(n),
    percent: (fraction: number) => percent.format(fraction),
    duration,
    /** Minutes or hours as a duration, e.g. TAT targets. */
    hours: (h: number) => duration(h * HOUR),
    relative: (ms: number, now: number) => {
      const diff = ms - now
      const abs = Math.abs(diff)
      if (abs < MINUTE) return relative.format(0, 'minute')
      if (abs < HOUR)
        return relative.format(Math.round(diff / MINUTE), 'minute')
      if (abs < 24 * HOUR)
        return relative.format(Math.round(diff / HOUR), 'hour')
      return relative.format(Math.round(diff / (24 * HOUR)), 'day')
    },
  }
}

export type Formatter = ReturnType<typeof createFormatter>

export function useFormat(): Formatter {
  const { language } = useLanguage()
  return useMemo(() => createFormatter(language), [language])
}
