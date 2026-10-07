// Invoice arithmetic: pure, in rupees, rounded to paise. Statuses are
// derived from the lines, discount, payments and refunds, never stored.

import type { Invoice, InvoiceLine, InvoiceStatus } from './types'

const paise = (n: number) => Math.round(n * 100) / 100

export const lineGross = (l: InvoiceLine) => paise(l.quantity * l.unitPrice)

export interface InvoiceTotals {
  gross: number
  discount: number
  taxable: number
  tax: number
  total: number
  paid: number
  refunded: number
  /** Still owed by the patient (an account invoice: by the account). */
  balance: number
}

/**
 * Totals with the discount shared across lines in proportion to their
 * value, so each line's tax is on what is actually charged.
 */
export function invoiceTotals(invoice: Invoice): InvoiceTotals {
  const gross = paise(invoice.lines.reduce((n, l) => n + lineGross(l), 0))
  const approved =
    invoice.discount && invoice.discount.approvedBy !== undefined
      ? Math.min(invoice.discount.amount, gross)
      : 0
  let tax = 0
  for (const l of invoice.lines) {
    const share = gross > 0 ? lineGross(l) / gross : 0
    const taxableLine = lineGross(l) - approved * share
    tax += (taxableLine * l.taxRate) / 100
  }
  const taxable = paise(gross - approved)
  tax = paise(tax)
  const total = paise(taxable + tax)
  const paid = paise(invoice.payments.reduce((n, p) => n + p.amount, 0))
  const refunded = paise(invoice.refunds.reduce((n, r) => n + r.amount, 0))
  return {
    gross,
    discount: paise(approved),
    taxable,
    tax,
    total,
    paid,
    refunded,
    balance: paise(total - paid),
  }
}

export function invoiceStatus(invoice: Invoice): InvoiceStatus {
  if (invoice.cancelled) return 'cancelled'
  const t = invoiceTotals(invoice)
  if (t.refunded > 0 && t.refunded >= t.paid) return 'refunded'
  if (t.balance <= 0) {
    return invoice.payments.some((p) => p.method === 'credit')
      ? 'on-account'
      : 'paid'
  }
  return t.paid > 0 ? 'partially-paid' : 'unpaid'
}

/** Indian GSTIN: 2-digit state, 10-character PAN, entity, Z, checksum. */
export const isGstin = (value: string) =>
  /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value.trim().toUpperCase())
