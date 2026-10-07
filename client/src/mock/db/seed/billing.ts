// Demo billing: packages, a corporate price list, credit accounts, and
// invoices with payments for the last two days of orders, issued through
// the billing engine as the front desk would. All names are fictional.

import { invoiceTotals } from '@/domain/billing'
import { DAY, HOUR, MINUTE, istDay, startOfIstDay } from '@/domain/time'
import type { PaymentMethod } from '@/domain/types'
import type { LabDb } from '../schema'
import {
  closeDay,
  createInvoice,
  expectedTakings,
  recordPayment,
  refundPayment,
  requestDiscount,
  saveAccount,
  savePackage,
  savePriceList,
} from '../../engine/billing'
import type { EngineCtx } from '../../engine/core'
import type { Rng } from './random'

const DESK = 'st_shruthi'
const MANAGER = 'st_ganesh'

export function seedBilling(db: LabDb, now: number, rng: Rng) {
  const setup: EngineCtx = { now: now - 30 * DAY, by: MANAGER }
  const pkg = (code: string, name: string, testIds: string[], price: number) =>
    savePackage(
      db,
      {
        code,
        name,
        testIds: testIds.filter((t) => db.tests[t]),
        price,
        active: true,
      },
      setup,
    )
  const mhc = pkg(
    'MHC',
    'Master Health Check',
    ['cbc', 'lft', 'kft', 'lipid', 'fbs', 'tsh_test', 'urine_re'],
    2499,
  )
  pkg('DIAB', 'Diabetes Profile', ['fbs', 'ppbs', 'hba1c', 'kft'], 999)
  pkg(
    'FEVER',
    'Fever Panel',
    ['cbc', 'crp', 'dengue_ns1', 'malaria', 'widal'],
    1299,
  )
  void mhc

  const corporatePrices = savePriceList(
    db,
    {
      name: 'Corporate staff scheme 2026',
      prices: Object.fromEntries(
        ['cbc', 'lft', 'kft', 'lipid', 'fbs', 'hba1c', 'tsh_test', 'urine_re']
          .filter((t) => db.tests[t])
          .map((t) => [t, Math.round(db.tests[t]!.price * 0.85)]),
      ),
      active: true,
    },
    setup,
  )
  const corporate = saveAccount(
    db,
    {
      name: 'Coromandel Cements Ltd (staff scheme)',
      kind: 'corporate',
      gstin: '33AAACC7741F1Z6',
      creditLimit: 200000,
      priceListId: corporatePrices.id,
      contact: 'hr.health@coromandel-cements.example',
      active: true,
    },
    setup,
  )
  saveAccount(
    db,
    {
      name: 'Sri Vari Health Insurance TPA',
      kind: 'insurance',
      creditLimit: 500000,
      contact: 'claims@srivari-tpa.example',
      active: true,
    },
    setup,
  )
  saveAccount(
    db,
    {
      name: 'Arogya Collection Point, Hosur',
      kind: 'collection-centre',
      creditLimit: 50000,
      contact: '+91 4344 220 118',
      active: true,
    },
    setup,
  )

  // Invoices for orders placed today and yesterday.
  const since = startOfIstDay(now) - DAY
  const orders = Object.values(db.orders)
    .filter((o) => o.state === 'active' && (o.orderedAt ?? 0) >= since)
    .toSorted((a, b) => (a.orderedAt ?? 0) - (b.orderedAt ?? 0))
  let pendingDone = false
  let smallDone = false
  let refunds = 0
  for (const order of orders) {
    if (!rng.chance(0.88)) continue
    const at = (order.orderedAt ?? now) + 3 * MINUTE
    if (at > now) continue
    const ctx: EngineCtx = { now: at, by: DESK }
    const onAccount = rng.chance(0.12)
    let invoice
    try {
      invoice = createInvoice(
        db,
        {
          orderId: order.id,
          ...(onAccount ? { accountId: corporate.id } : {}),
        },
        ctx,
      )
    } catch {
      continue
    }
    // Yesterday one small discount applied at the desk; today one above the
    // lab's limit waits for the manager (so the approval queue shows).
    const gross = invoiceTotals(invoice).gross
    const today = istDay(at) === istDay(now)
    if (gross > 1200 && (today ? !pendingDone : !smallDone)) {
      requestDiscount(
        db,
        invoice.id,
        today
          ? {
              amount: Math.round(gross * 0.2),
              reason: 'Senior citizen, repeat visit within a week',
            }
          : { amount: Math.round(gross * 0.05), reason: 'Staff family member' },
        ctx,
      )
      if (today) {
        pendingDone = true
        continue
      }
      smallDone = true
    }
    const { balance } = invoiceTotals(invoice)
    if (balance <= 0) continue
    const method: PaymentMethod = onAccount
      ? 'credit'
      : rng.pick(['cash', 'cash', 'upi', 'upi', 'card'] as const)
    const partial = !onAccount && rng.chance(0.1)
    const amount = partial ? Math.round(balance / 2) : balance
    recordPayment(
      db,
      invoice.id,
      {
        method,
        amount,
        ...(method === 'upi'
          ? { reference: `UPI${Math.floor(rng.between(100000000, 999999999))}` }
          : method === 'card'
            ? { reference: `CARD-${Math.floor(rng.between(1000, 9999))}` }
            : {}),
      },
      { now: at + MINUTE, by: DESK },
    )
    if (
      refunds === 0 &&
      method === 'cash' &&
      istDay(at) !== istDay(now) &&
      at + 2 * HOUR < startOfIstDay(now) - 10 * MINUTE
    ) {
      refundPayment(
        db,
        invoice.id,
        {
          amount: Math.min(amount, 250),
          method: 'cash',
          reason:
            'Test not done: specimen rejected, patient declined recollection',
        },
        { now: at + 2 * HOUR, by: MANAGER },
      )
      refunds += 1
    }
  }

  // Yesterday's cash was counted and closed at night.
  const yesterday = istDay(now - DAY)
  const closeAt = startOfIstDay(now) - 10 * MINUTE
  const expected = expectedTakings(db, yesterday)
  closeDay(
    db,
    {
      counted: { ...expected, cash: Math.max(0, expected.cash - 20) },
      note: 'Short by INR 20: change given twice, confirmed with the patient by phone.',
    },
    { now: closeAt, by: DESK },
  )
}
