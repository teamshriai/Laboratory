// Shared billing helpers: money in rupees and paise, and the lists of
// choices the billing screens offer.

import { useCallback, useMemo } from 'react'
import type { InvoiceStatus, PaymentMethod } from '@/domain/types'
import { useLanguage } from '@/i18n/context'
import { translate } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import type { DatePreset, InvoiceDetail } from '@/services/lab-api'

export const BILLING_DATES = [
  'today',
  'yesterday',
  '7d',
  '30d',
  'all',
] as const satisfies readonly DatePreset[]

/** The status tabs, in the order the desk works through them. */
export const STATUS_TABS = [
  'unpaid',
  'partially-paid',
  'paid',
  'on-account',
  'refunded',
  'cancelled',
] as const satisfies readonly InvoiceStatus[]

/** Methods money is counted in at the day's close (credit is not cash). */
export const TILL_METHODS = ['cash', 'card', 'upi'] as const satisfies Exclude<
  PaymentMethod,
  'credit'
>[]
export type TillMethod = (typeof TILL_METHODS)[number]

export const MASTER_TABS = ['packages', 'accounts', 'price-lists'] as const
export type MasterTab = (typeof MASTER_TABS)[number]

export const CANCEL_INVOICE_REASONS = [
  'wrong-tests',
  'wrong-patient',
  'duplicate',
  'price-correction',
  'other',
] as const
export type CancelInvoiceReason = (typeof CANCEL_INVOICE_REASONS)[number]

/** Payment methods that need a card slip or UPI transaction reference. */
export const needsReference = (method: PaymentMethod) =>
  method === 'card' || method === 'upi'

export const paise = (n: number) => Math.round(n * 100) / 100

/** A typed amount as rupees, or null when it is not a number. */
export function parseAmount(value: string) {
  const text = value.trim().replace(/,/g, '')
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? paise(n) : null
}

/** INR with paise, for invoices, payments and the cash count. */
export function useMoney() {
  const { locale } = useFormat()
  return useMemo(() => {
    const format = new Intl.NumberFormat(locale, {
      numberingSystem: 'latn',
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return (n: number) => format.format(n)
  }, [locale])
}

/** What can still be refunded: money received at the desk, less refunds. */
export const refundable = (invoice: InvoiceDetail) =>
  paise(
    invoice.payments
      .filter((p) => p.method !== 'credit')
      .reduce((n, p) => n + p.amount, 0) -
      invoice.refunds.reduce((n, r) => n + r.amount, 0),
  )

/**
 * Resolves "billing.x" validation keys to text; "forms.x" and "errors.x"
 * pass through for Field to resolve.
 */
export function useBillingMessage() {
  const { language } = useLanguage()
  return useCallback(
    (message: string | undefined) =>
      message?.startsWith('billing.')
        ? translate(language, 'billing', message.slice(8))
        : message,
    [language],
  )
}
