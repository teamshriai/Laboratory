// Billing: invoices from orders (with packages and account price lists),
// discounts with approval above the lab's limit, payments (cash, card, UPI,
// or on account), refunds and the day's cash close. Every step is audited.
//
// Nothing here moves money: payments are records of what the front desk
// received. A backend connects a payment gateway or the hospital's billing.

import { invoiceTotals } from '@/domain/billing'
import { nextSequence } from '@/domain/ids'
import { randomToken } from '@/domain/sha256'
import { istDay, istDayCompact } from '@/domain/time'
import {
  ACCOUNT_KINDS,
  PAYMENT_METHODS,
  type CashClose,
  type CreditAccount,
  type Invoice,
  type InvoiceLine,
  type PaymentMethod,
  type PriceList,
  type TestPackage,
} from '@/domain/types'
import { isItemLive } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import {
  audit,
  itemsOfOrder,
  LabApiError,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

const id = (prefix: string) => `${prefix}_${randomToken(9)}`
const rupees = (n: number) => Math.round(n * 100) / 100
const money = (n: number) => `INR ${rupees(n).toFixed(2)}`

function checkAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new LabApiError('amount-invalid')
  return rupees(amount)
}

/** Money owed by an account across its open invoices. */
export function accountBalance(db: LabDb, accountId: string) {
  return rupees(
    Object.values(db.invoices)
      .filter((i) => i.accountId === accountId && !i.cancelled)
      .reduce(
        (n, i) =>
          n +
          i.payments
            .filter((p) => p.method === 'credit')
            .reduce((m, p) => m + p.amount, 0),
        0,
      ),
  )
}

export interface InvoiceInput {
  orderId: string
  accountId?: string
  /** Packages that replace the separate lines of their tests. */
  packageIds?: string[]
  /** Extra charges, e.g. home collection. */
  charges?: { description: string; amount: number }[]
}

/** Invoices an order: one invoice per order, from its live tests. */
export function createInvoice(db: LabDb, input: InvoiceInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'billing.invoice')
  const order = must(db.orders, input.orderId, 'order')
  if (order.state !== 'active') throw new LabApiError('invalid-transition')
  if (
    Object.values(db.invoices).some(
      (i) => i.orderId === order.id && !i.cancelled,
    )
  )
    throw new LabApiError('invoice-exists')
  const account = input.accountId
    ? must(db.accounts, input.accountId, 'account')
    : undefined
  if (account && !account.active) throw new LabApiError('invalid-transition')
  const prices = account?.priceListId
    ? db.priceLists[account.priceListId]
    : undefined
  const { defaultSac, taxRate } = db.settings.billing
  const items = itemsOfOrder(db, order.id).filter(isItemLive)
  const lines: InvoiceLine[] = []
  const covered = new Set<string>()
  for (const pkgId of input.packageIds ?? []) {
    const pkg = must(db.packages, pkgId, 'package')
    if (
      !pkg.active ||
      !pkg.testIds.every((t) => items.some((i) => i.testId === t))
    )
      throw new LabApiError('validation-failed', { field: 'package' })
    pkg.testIds.forEach((t) => covered.add(t))
    lines.push({
      id: id('ln'),
      kind: 'package',
      refId: pkg.id,
      description: pkg.name,
      sac: defaultSac,
      quantity: 1,
      unitPrice: pkg.price,
      taxRate,
    })
  }
  for (const item of items) {
    if (covered.has(item.testId)) continue
    lines.push({
      id: id('ln'),
      kind: 'test',
      refId: item.testId,
      description: item.testName,
      sac: defaultSac,
      quantity: 1,
      unitPrice: prices?.active
        ? (prices.prices[item.testId] ?? item.price)
        : item.price,
      taxRate,
    })
  }
  for (const c of input.charges ?? []) {
    const description = c.description.trim()
    if (!description)
      throw new LabApiError('validation-failed', { field: 'charge' })
    lines.push({
      id: id('ln'),
      kind: 'charge',
      description,
      sac: defaultSac,
      quantity: 1,
      unitPrice: checkAmount(c.amount),
      taxRate,
    })
  }
  if (lines.length === 0) throw new LabApiError('order-empty')
  const prefix = `INV-${istDayCompact(ctx.now)}-`
  const invoice: Invoice = {
    id: id('inv'),
    invoiceNo: nextSequence(
      Object.values(db.invoices).map((i) => i.invoiceNo),
      prefix,
      4,
    ),
    patientId: order.patientId,
    orderId: order.id,
    ...(account ? { accountId: account.id } : {}),
    lines,
    issuedAt: ctx.now,
    issuedBy: ctx.by,
    payments: [],
    refunds: [],
    ...(db.settings.billing.gstin
      ? { sellerGstin: db.settings.billing.gstin }
      : {}),
  }
  db.invoices[invoice.id] = invoice
  audit(db, ctx, 'invoice', invoice.id, 'issued', {
    detail: {
      invoice: invoice.invoiceNo,
      total: money(invoiceTotals(invoice).total),
    },
  })
  return invoice
}

/**
 * A discount up to the lab's limit (% of the bill) applies at once; above
 * it, it waits for someone who may approve discounts.
 */
export function requestDiscount(
  db: LabDb,
  invoiceId: string,
  input: { amount: number; reason: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'billing.invoice')
  const invoice = must(db.invoices, invoiceId, 'invoice')
  if (invoice.cancelled || invoice.payments.length > 0)
    throw new LabApiError('invoice-has-payments')
  const amount = checkAmount(input.amount)
  const reason = input.reason.trim()
  if (!reason) throw new LabApiError('reason-required')
  const { gross } = invoiceTotals(invoice)
  if (amount > gross) throw new LabApiError('amount-invalid')
  const limit = (gross * db.settings.billing.discountApprovalPct) / 100
  const canApprove = db.staff[ctx.by] ? hasApproval(db, ctx) : false
  const approvedNow = amount <= limit || canApprove
  invoice.discount = {
    amount,
    reason,
    requestedBy: ctx.by,
    requestedAt: ctx.now,
    ...(approvedNow ? { approvedBy: ctx.by, approvedAt: ctx.now } : {}),
  }
  audit(
    db,
    ctx,
    'invoice',
    invoice.id,
    approvedNow ? 'discount-applied' : 'discount-requested',
    {
      reason,
      detail: { invoice: invoice.invoiceNo, amount: money(amount) },
    },
  )
  return invoice
}

function hasApproval(db: LabDb, ctx: EngineCtx) {
  try {
    requirePermission(db, ctx, 'billing.discount.approve')
    return true
  } catch {
    return false
  }
}

export function approveDiscount(
  db: LabDb,
  invoiceId: string,
  approve: boolean,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'billing.discount.approve')
  const invoice = must(db.invoices, invoiceId, 'invoice')
  const discount = invoice.discount
  if (!discount || discount.approvedBy)
    throw new LabApiError('invalid-transition')
  if (approve) {
    discount.approvedBy = ctx.by
    discount.approvedAt = ctx.now
  } else {
    delete invoice.discount
  }
  audit(
    db,
    ctx,
    'invoice',
    invoice.id,
    approve ? 'discount-approved' : 'discount-declined',
    {
      detail: { invoice: invoice.invoiceNo, amount: money(discount.amount) },
    },
  )
  return invoice
}

export function recordPayment(
  db: LabDb,
  invoiceId: string,
  input: { method: PaymentMethod; amount: number; reference?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'billing.payment')
  const invoice = must(db.invoices, invoiceId, 'invoice')
  if (invoice.cancelled) throw new LabApiError('invalid-transition')
  if (!PAYMENT_METHODS.includes(input.method))
    throw new LabApiError('validation-failed', { field: 'method' })
  if (invoice.discount && !invoice.discount.approvedBy)
    throw new LabApiError('discount-pending')
  if (db.cashCloses[istDay(ctx.now)] && input.method !== 'credit')
    throw new LabApiError('day-closed')
  const amount = checkAmount(input.amount)
  const { balance } = invoiceTotals(invoice)
  if (amount > balance) throw new LabApiError('amount-invalid')
  const reference = input.reference?.trim()
  if ((input.method === 'card' || input.method === 'upi') && !reference)
    throw new LabApiError('reference-required')
  if (input.method === 'credit') {
    const account = invoice.accountId
      ? db.accounts[invoice.accountId]
      : undefined
    if (!account)
      throw new LabApiError('validation-failed', { field: 'account' })
    if (accountBalance(db, account.id) + amount > account.creditLimit)
      throw new LabApiError('over-credit-limit', {
        account: account.name,
        limit: money(account.creditLimit),
      })
  }
  invoice.payments.push({
    id: id('pay'),
    method: input.method,
    amount,
    at: ctx.now,
    by: ctx.by,
    ...(reference ? { reference } : {}),
  })
  audit(db, ctx, 'invoice', invoice.id, 'payment-recorded', {
    detail: {
      invoice: invoice.invoiceNo,
      method: input.method,
      amount: money(amount),
    },
  })
  return invoice
}

export function refundPayment(
  db: LabDb,
  invoiceId: string,
  input: {
    amount: number
    method: Exclude<PaymentMethod, 'credit'>
    reason: string
  },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'billing.refund')
  const invoice = must(db.invoices, invoiceId, 'invoice')
  const amount = checkAmount(input.amount)
  const reason = input.reason.trim()
  if (!reason) throw new LabApiError('reason-required')
  const received = invoice.payments
    .filter((p) => p.method !== 'credit')
    .reduce((n, p) => n + p.amount, 0)
  const refunded = invoice.refunds.reduce((n, r) => n + r.amount, 0)
  if (amount > rupees(received - refunded))
    throw new LabApiError('refund-too-large')
  invoice.refunds.push({
    id: id('rfd'),
    amount,
    method: input.method,
    reason,
    at: ctx.now,
    by: ctx.by,
  })
  audit(db, ctx, 'invoice', invoice.id, 'refunded', {
    reason,
    detail: { invoice: invoice.invoiceNo, amount: money(amount) },
  })
  return invoice
}

/** An invoice with no payments can be cancelled (re-issue a corrected one). */
export function cancelInvoice(
  db: LabDb,
  invoiceId: string,
  reason: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'billing.invoice')
  const invoice = must(db.invoices, invoiceId, 'invoice')
  if (invoice.cancelled) throw new LabApiError('invalid-transition')
  if (invoice.payments.length > 0) throw new LabApiError('invoice-has-payments')
  const text = reason.trim()
  if (!text) throw new LabApiError('reason-required')
  invoice.cancelled = { at: ctx.now, by: ctx.by, reason: text }
  audit(db, ctx, 'invoice', invoice.id, 'cancelled', {
    reason: text,
    detail: { invoice: invoice.invoiceNo },
  })
  return invoice
}

/** What the day's payments say was received, by method (refunds out). */
export function expectedTakings(db: LabDb, day: string) {
  const out = { cash: 0, card: 0, upi: 0 }
  for (const invoice of Object.values(db.invoices)) {
    for (const p of invoice.payments)
      if (p.method !== 'credit' && istDay(p.at) === day)
        out[p.method] += p.amount
    for (const r of invoice.refunds)
      if (istDay(r.at) === day) out[r.method] -= r.amount
  }
  return {
    cash: rupees(out.cash),
    card: rupees(out.card),
    upi: rupees(out.upi),
  }
}

/**
 * Closes the day: the counted cash, card and UPI totals against what the
 * payments say. Once closed, no more payments are taken for that day.
 */
export function closeDay(
  db: LabDb,
  input: { counted: CashClose['counted']; note?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'billing.close')
  const day = istDay(ctx.now)
  if (db.cashCloses[day]) throw new LabApiError('day-closed')
  for (const v of Object.values(input.counted))
    if (!Number.isFinite(v) || v < 0) throw new LabApiError('amount-invalid')
  const expected = expectedTakings(db, day)
  const close: CashClose = {
    id: day,
    day,
    at: ctx.now,
    by: ctx.by,
    expected,
    counted: {
      cash: rupees(input.counted.cash),
      card: rupees(input.counted.card),
      upi: rupees(input.counted.upi),
    },
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  }
  const difference = rupees(
    close.counted.cash +
      close.counted.card +
      close.counted.upi -
      (expected.cash + expected.card + expected.upi),
  )
  if (difference !== 0 && !close.note) throw new LabApiError('reason-required')
  db.cashCloses[day] = close
  audit(db, ctx, 'invoice', day, 'day-closed', {
    ...(close.note ? { reason: close.note } : {}),
    detail: { day, difference: money(difference) },
  })
  return close
}

// ---------- Masters: packages, accounts, price lists ----------

export function savePackage(
  db: LabDb,
  input: Omit<TestPackage, 'id'> & { id?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'billing.manage')
  const name = input.name.trim()
  const code = input.code.trim().toUpperCase()
  if (!name || !code)
    throw new LabApiError('validation-failed', { field: 'name' })
  if (input.testIds.length < 2 || input.testIds.some((t) => !db.tests[t]))
    throw new LabApiError('validation-failed', { field: 'tests' })
  checkAmount(input.price)
  if (
    Object.values(db.packages).some((p) => p.code === code && p.id !== input.id)
  )
    throw new LabApiError('duplicate-code', { code })
  const pkg: TestPackage = {
    id: input.id ?? id('pkg'),
    code,
    name,
    testIds: [...new Set(input.testIds)],
    price: rupees(input.price),
    active: input.active,
  }
  const before = input.id ? db.packages[input.id] : undefined
  db.packages[pkg.id] = pkg
  audit(
    db,
    ctx,
    'invoice',
    pkg.id,
    before ? 'package-updated' : 'package-created',
    {
      ...(before ? { from: money(before.price) } : {}),
      to: money(pkg.price),
      detail: { package: pkg.name },
    },
  )
  return pkg
}

export function saveAccount(
  db: LabDb,
  input: Omit<CreditAccount, 'id'> & { id?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'billing.manage')
  const name = input.name.trim()
  if (!name) throw new LabApiError('validation-failed', { field: 'name' })
  if (!ACCOUNT_KINDS.includes(input.kind))
    throw new LabApiError('validation-failed', { field: 'kind' })
  if (!Number.isFinite(input.creditLimit) || input.creditLimit < 0)
    throw new LabApiError('amount-invalid')
  if (input.priceListId && !db.priceLists[input.priceListId])
    throw new LabApiError('validation-failed', { field: 'priceList' })
  const account: CreditAccount = {
    id: input.id ?? id('acc'),
    name,
    kind: input.kind,
    creditLimit: rupees(input.creditLimit),
    contact: input.contact.trim(),
    active: input.active,
    ...(input.gstin?.trim() ? { gstin: input.gstin.trim().toUpperCase() } : {}),
    ...(input.priceListId ? { priceListId: input.priceListId } : {}),
  }
  const existed = Boolean(input.id && db.accounts[input.id])
  db.accounts[account.id] = account
  audit(
    db,
    ctx,
    'invoice',
    account.id,
    existed ? 'account-updated' : 'account-created',
    {
      detail: { account: account.name, limit: money(account.creditLimit) },
    },
  )
  return account
}

export function savePriceList(
  db: LabDb,
  input: Omit<PriceList, 'id'> & { id?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'billing.manage')
  const name = input.name.trim()
  if (!name) throw new LabApiError('validation-failed', { field: 'name' })
  for (const [testId, price] of Object.entries(input.prices)) {
    if (!db.tests[testId])
      throw new LabApiError('validation-failed', { field: 'tests' })
    checkAmount(price)
  }
  const list: PriceList = {
    id: input.id ?? id('prl'),
    name,
    prices: Object.fromEntries(
      Object.entries(input.prices).map(([k, v]) => [k, rupees(v)]),
    ),
    active: input.active,
  }
  const existed = Boolean(input.id && db.priceLists[input.id])
  db.priceLists[list.id] = list
  audit(
    db,
    ctx,
    'invoice',
    list.id,
    existed ? 'price-list-updated' : 'price-list-created',
    {
      detail: { list: list.name, tests: Object.keys(list.prices).length },
    },
  )
  return list
}
