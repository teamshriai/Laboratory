// Billing reads and writes: invoices, the day book and cash close, and the
// billing masters (packages, credit accounts, price lists).

import { invoiceStatus, invoiceTotals, lineGross } from '@/domain/billing'
import { istDay } from '@/domain/time'
import {
  INVOICE_STATUSES,
  type Invoice,
  type PaymentMethod,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  accountBalance,
  approveDiscount,
  cancelInvoice,
  closeDay,
  createInvoice,
  expectedTakings,
  recordPayment,
  refundPayment,
  requestDiscount,
  saveAccount,
  savePackage,
  savePriceList,
  type InvoiceInput,
} from '../engine/billing'
import { must } from '../engine/core'
import { paginate, type Sorters } from './paging'
import { read, write } from './runtime'
import type {
  BillingMasters,
  DayBook,
  InvoiceDetail,
  InvoiceFilters,
  InvoiceListResult,
  InvoiceRow,
} from './types'
import {
  inDateRange,
  matchesQuery,
  patientSearchFields,
  patientSummary,
  staffName,
} from './views'

function invoiceRow(db: LabDb, invoice: Invoice): InvoiceRow {
  const totals = invoiceTotals(invoice)
  const order = invoice.orderId ? db.orders[invoice.orderId] : undefined
  const row: InvoiceRow = {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    patient: patientSummary(db.patients[invoice.patientId]!),
    issuedAt: invoice.issuedAt,
    status: invoiceStatus(invoice),
    total: totals.total,
    paid: totals.paid,
    balance: totals.balance,
    discountPending: Boolean(
      invoice.discount && invoice.discount.approvedBy === undefined,
    ),
  }
  if (order) {
    row.orderId = order.id
    row.orderNo = order.orderNo
  }
  if (invoice.accountId)
    row.accountName = db.accounts[invoice.accountId]?.name ?? invoice.accountId
  return row
}

function invoiceDetail(db: LabDb, invoice: Invoice): InvoiceDetail {
  const detail: InvoiceDetail = {
    ...invoiceRow(db, invoice),
    lines: invoice.lines.map((l) => ({ ...l, amount: lineGross(l) })),
    totals: invoiceTotals(invoice),
    payments: invoice.payments.map((p) => ({
      ...p,
      byName: staffName(db, p.by),
    })),
    refunds: invoice.refunds.map((r) => ({
      ...r,
      byName: staffName(db, r.by),
    })),
    issuedByName: staffName(db, invoice.issuedBy),
    lab: {
      labName: db.settings.labName,
      labAddress: db.settings.labAddress,
      labRegistration: db.settings.labRegistration,
    },
  }
  if (invoice.discount)
    detail.discount = {
      ...invoice.discount,
      requestedByName: staffName(db, invoice.discount.requestedBy),
      ...(invoice.discount.approvedBy
        ? { approvedByName: staffName(db, invoice.discount.approvedBy) }
        : {}),
    }
  if (invoice.cancelled)
    detail.cancelled = {
      at: invoice.cancelled.at,
      byName: staffName(db, invoice.cancelled.by),
      reason: invoice.cancelled.reason,
    }
  if (invoice.sellerGstin) detail.sellerGstin = invoice.sellerGstin
  const buyer = invoice.accountId
    ? db.accounts[invoice.accountId]?.gstin
    : undefined
  if (buyer) detail.buyerGstin = buyer
  return detail
}

const SORTERS: Sorters<InvoiceRow> = {
  invoice: (r) => r.issuedAt,
  patient: (r) => r.patient.name,
  total: (r) => r.total,
  balance: (r) => r.balance,
}

export const billingApi = {
  list: (filters: InvoiceFilters = {}) =>
    read((db, { now }): InvoiceListResult => {
      const all: InvoiceRow[] = []
      for (const invoice of Object.values(db.invoices)) {
        if (!inDateRange(invoice.issuedAt, filters.date ?? 'today', now))
          continue
        if (filters.accountId && invoice.accountId !== filters.accountId)
          continue
        const patient = db.patients[invoice.patientId]
        if (
          !matchesQuery(filters.q, [
            invoice.invoiceNo,
            ...(patient ? patientSearchFields(patient) : []),
          ])
        )
          continue
        all.push(invoiceRow(db, invoice))
      }
      const counts = Object.fromEntries([
        ['all', all.length],
        ...INVOICE_STATUSES.map((s) => [s, 0]),
      ]) as InvoiceListResult['counts']
      for (const row of all) counts[row.status] += 1
      const status = filters.status ?? 'all'
      const newest = all
        .filter((r) => status === 'all' || r.status === status)
        .toSorted((a, b) => b.issuedAt - a.issuedAt)
      const totals = {
        outstanding: all
          .filter((r) => r.status !== 'cancelled')
          .reduce((n, r) => n + Math.max(0, r.balance), 0),
        discountsPending: all.filter((r) => r.discountPending).length,
      }
      return { ...paginate(newest, filters, SORTERS), counts, totals }
    }),

  get: (id: string) =>
    read((db) => invoiceDetail(db, must(db.invoices, id, 'invoice'))),

  /** The order's invoice, if it has one (cancelled ones excluded). */
  forOrder: (orderId: string) =>
    read((db): InvoiceDetail | null => {
      const invoice = Object.values(db.invoices).find(
        (i) => i.orderId === orderId && !i.cancelled,
      )
      return invoice ? invoiceDetail(db, invoice) : null
    }),

  create: (input: InvoiceInput) =>
    write((db, ctx) => createInvoice(db, input, ctx).id),

  requestDiscount: (id: string, input: { amount: number; reason: string }) =>
    write((db, ctx) => {
      const invoice = requestDiscount(db, id, input, ctx)
      return { approved: invoice.discount?.approvedBy !== undefined }
    }),

  approveDiscount: (id: string, approve: boolean) =>
    write((db, ctx) => void approveDiscount(db, id, approve, ctx)),

  pay: (
    id: string,
    input: { method: PaymentMethod; amount: number; reference?: string },
  ) => write((db, ctx) => void recordPayment(db, id, input, ctx)),

  refund: (
    id: string,
    input: {
      amount: number
      method: Exclude<PaymentMethod, 'credit'>
      reason: string
    },
  ) => write((db, ctx) => void refundPayment(db, id, input, ctx)),

  cancel: (id: string, reason: string) =>
    write((db, ctx) => void cancelInvoice(db, id, reason, ctx)),

  /** The day's payments and refunds, what they add up to, and the close. */
  dayBook: (day?: string) =>
    read((db, { now }): DayBook => {
      const key = day ?? istDay(now)
      const entries: DayBook['entries'] = []
      for (const invoice of Object.values(db.invoices)) {
        const patientName = db.patients[invoice.patientId]?.name ?? ''
        for (const p of invoice.payments)
          if (istDay(p.at) === key)
            entries.push({
              invoiceId: invoice.id,
              invoiceNo: invoice.invoiceNo,
              patientName,
              kind: 'payment',
              method: p.method,
              amount: p.amount,
              at: p.at,
              byName: staffName(db, p.by),
            })
        for (const r of invoice.refunds)
          if (istDay(r.at) === key)
            entries.push({
              invoiceId: invoice.id,
              invoiceNo: invoice.invoiceNo,
              patientName,
              kind: 'refund',
              method: r.method,
              amount: r.amount,
              at: r.at,
              byName: staffName(db, r.by),
            })
      }
      const close = db.cashCloses[key]
      return {
        day: key,
        expected: expectedTakings(db, key),
        entries: entries.toSorted((a, b) => b.at - a.at),
        ...(close
          ? { close: { ...close, byName: staffName(db, close.by) } }
          : {}),
      }
    }),

  closeDay: (input: {
    counted: Record<'cash' | 'card' | 'upi', number>
    note?: string
  }) => write((db, ctx) => void closeDay(db, input, ctx)),

  masters: () =>
    read((db): BillingMasters => ({
      packages: Object.values(db.packages).toSorted((a, b) =>
        a.name.localeCompare(b.name),
      ),
      accounts: Object.values(db.accounts)
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ ...a, owed: accountBalance(db, a.id) })),
      priceLists: Object.values(db.priceLists).toSorted((a, b) =>
        a.name.localeCompare(b.name),
      ),
    })),

  savePackage: (input: Parameters<typeof savePackage>[1]) =>
    write((db, ctx) => savePackage(db, input, ctx).id),
  saveAccount: (input: Parameters<typeof saveAccount>[1]) =>
    write((db, ctx) => saveAccount(db, input, ctx).id),
  savePriceList: (input: Parameters<typeof savePriceList>[1]) =>
    write((db, ctx) => savePriceList(db, input, ctx).id),
}
