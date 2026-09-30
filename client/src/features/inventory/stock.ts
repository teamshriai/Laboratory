// Helpers shared by the inventory screens (overview, reagent lots, consumables).

import { useMemo } from 'react'
import { EXPIRY_WARNING_DAYS } from '@/domain/stock'
import { DAY, istDay } from '@/domain/time'
import { STOCK_STATUSES, type StockStatus } from '@/domain/types'
import type { LotRow } from '@/services/lab-api'
import { useFormat } from '@/i18n/format'
import { useReference } from '@/services/queries'

export type Urgency = 'danger' | 'warning' | 'neutral'

/** Whole days until a timestamp; negative once it has passed. */
export function daysUntil(at: number, now: number) {
  return Math.floor((at - now) / DAY)
}

/** Colour urgency for an expiry date: past or within a week is danger, within the warning window is warning. */
export function expiryUrgency(expiresAt: number, now: number): Urgency {
  const days = daysUntil(expiresAt, now)
  if (expiresAt <= now || days < 7) return 'danger'
  if (days <= EXPIRY_WARNING_DAYS) return 'warning'
  return 'neutral'
}

/** Urgency for days of stock left at current usage. */
export function coverUrgency(days: number | null): Urgency {
  if (days === null) return 'neutral'
  if (days < 7) return 'danger'
  if (days < 14) return 'warning'
  return 'neutral'
}

/** Converts a date input value (YYYY-MM-DD) to the end of that day in IST. */
export function dateInputToMs(value: string) {
  return Date.parse(`${value}T23:59:00+05:30`)
}

/** True when a date input value is a valid calendar day after today (IST). */
export function isFutureDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(dateInputToMs(value)))
    return false
  return value > istDay(Date.now())
}

export function parseStockStatus(value: string | null): StockStatus | 'all' {
  return value && (STOCK_STATUSES as readonly string[]).includes(value)
    ? (value as StockStatus)
    : 'all'
}

/** Rounds stock quantities so fractional units (litres) stay readable. */
export function roundQty(value: number) {
  return Math.round(value * 100) / 100
}

/** Signed quantity with unit, e.g. "+500 tests" or "-12 tests". */
export function useSignedQty() {
  const f = useFormat()
  return (value: number, unit: string) =>
    `${value > 0 ? '+' : value < 0 ? '-' : ''}${f.decimal(roundQty(Math.abs(value)))} ${unit}`
}

/** Staff id to display name, from the reference data. */
export function useStaffName() {
  const { data } = useReference()
  return useMemo(() => {
    const names = new Map((data?.staff ?? []).map((s) => [s.id, s.name]))
    return (id: string) => names.get(id) ?? id
  }, [data])
}

export type LotActionKind =
  'adjust' | 'quarantine' | 'release' | 'expire' | 'dispose' | 'transfer'
export interface LotAction {
  kind: LotActionKind
  lot: LotRow
}

/** Which lot actions the engine allows for a lot right now. */
export function lotActions(lot: LotRow, now: number) {
  return {
    adjust: lot.state === 'active' || lot.state === 'quarantined',
    quarantine: lot.state === 'active',
    release: lot.state === 'quarantined' && lot.expiresAt > now,
    expire: lot.state === 'active' && lot.expiresAt <= now,
    dispose:
      lot.quantity > 0 && lot.state !== 'disposed' && lot.state !== 'depleted',
    transfer:
      lot.quantity > 0 &&
      (lot.state === 'active' || lot.state === 'quarantined'),
    open: lot.state === 'active' && !lot.openedAt,
  }
}
