// Shared helpers for the quality system screen: its tabs, the filters each
// tab keeps in the URL, risk-level tones and date inputs in IST.

import { useCallback } from 'react'
import type { RiskLevel } from '@/domain/quality'
import { NC_STATES, RULE_STATES } from '@/domain/types'
import { istDay } from '@/domain/time'
import { useEnum, useLanguage } from '@/i18n/context'
import { translate } from '@/i18n/core'
import { useReference } from '@/services/queries'
import type { BadgeTone } from '@/components/ui/badge'
import type { ComboOption } from '@/components/ui/combobox'

export const QUALITY_TABS = [
  'overview',
  'eqa',
  'capa',
  'documents',
  'audits',
  'risks',
  'lis',
  'uncertainty',
  'autoverify',
] as const
export type QualityTab = (typeof QUALITY_TABS)[number]

/** The CAPA list's state filter: the work still open first. */
export const NC_FILTERS = ['active', ...NC_STATES, 'all'] as const
export type NcFilter = (typeof NC_FILTERS)[number]

/** The auto-verification rules filter. */
export const RULE_FILTERS = ['current', ...RULE_STATES, 'all'] as const
export type RuleFilter = (typeof RULE_FILTERS)[number]

export const RISK_RATINGS = ['1', '2', '3', '4', '5'] as const
export type RiskRating = (typeof RISK_RATINGS)[number]

export const RISK_TONE: Record<RiskLevel, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  extreme: 'danger',
}

/** Heat-map cells: a soft fill per level (the level is also written out). */
export const RISK_CELL: Record<RiskLevel, string> = {
  low: 'bg-success-soft text-success-text',
  medium: 'bg-warning-soft text-warning-text',
  high: 'bg-danger-soft text-danger-text',
  extreme:
    'bg-danger-soft text-danger-text font-bold ring-2 ring-inset ring-danger-text/45',
}

/** A date input's YYYY-MM-DD as the end of that day in IST. */
export function endOfIstDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const at = Date.parse(`${value}T23:59:00+05:30`)
  return Number.isFinite(at) ? at : null
}

/** Epoch ms as a date input's YYYY-MM-DD (the IST day). */
export const toDateInput = (at: number) => istDay(at)

/** A typed decimal, or null when it is not a number. */
export function parseDecimal(value: string) {
  const text = value.trim().replace(/,/g, '')
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

/**
 * Resolves "quality.x" validation keys to text; "forms.x" and "errors.x"
 * pass through for Field to resolve.
 */
export function useQualityMessage() {
  const { language } = useLanguage()
  return useCallback(
    (message: string | undefined) =>
      message?.startsWith('quality.')
        ? translate(language, 'quality', message.slice(8))
        : message,
    [language],
  )
}

/** Staff who can own quality work (everyone but referring doctors). */
export function useStaffOptions() {
  const { data } = useReference()
  const e = useEnum()
  return (data?.staff ?? [])
    .filter((s) => s.role !== 'doctor')
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((s): ComboOption => ({
      value: s.id,
      label: s.name,
      description: e('staffRole', s.role),
      keywords: [e('staffRole', s.role)],
    }))
}
