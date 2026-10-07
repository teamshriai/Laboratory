// Billing rules and their refusals: one invoice per order, packages and
// account prices, discount approval, payment references, credit limits,
// refunds, cancellation and the day's cash close.

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { actingAs, STAFF } from './testing'

const desk = actingAs(STAFF.reception)
const manager = actingAs(STAFF.manager)
const phlebotomist = actingAs(STAFF.phlebotomist)

let patients = 0
async function newOrder(testIds: string[]) {
  patients += 1
  const { id: patientId } = await desk.patients.register({
    name: `Billing Patient ${String.fromCharCode(64 + patients)}`,
    sex: 'F',
    dob: '1988-03-14',
    mobile: '9845011223',
    allergies: [],
    city: 'Trichy',
    state: 'Tamil Nadu',
    encounter: { type: 'OPD', department: 'general-medicine' },
  })
  const { id } = await desk.orders.create({
    patientId,
    doctorId: 'dr_asha',
    department: 'general-medicine',
    encounter: 'OPD',
    priority: 'routine',
    clinicalNotes: '',
    testIds,
  })
  return id
}

describe('billing', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('invoices an order once, from its tests, with packages and account prices', async () => {
    const orderId = await newOrder([
      'cbc',
      'crp',
      'dengue_ns1',
      'malaria',
      'widal',
      'tsh_test',
    ])
    await expect(
      phlebotomist.billing.create({ orderId }),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    const fever = Object.values(getDb().packages).find(
      (p) => p.code === 'FEVER',
    )!
    const id = await desk.billing.create({ orderId, packageIds: [fever.id] })
    const invoice = await labApi.billing.get(id)
    // The package replaces its five tests; TSH stays a line of its own.
    expect(invoice.lines.map((l) => l.kind).toSorted()).toEqual([
      'package',
      'test',
    ])
    expect(invoice.totals.gross).toBe(
      fever.price + getDb().tests.tsh_test!.price,
    )
    expect(invoice.status).toBe('unpaid')
    expect(invoice.invoiceNo).toMatch(/^INV-\d{8}-\d{4}$/)
    await expect(desk.billing.create({ orderId })).rejects.toMatchObject({
      code: 'invoice-exists',
    })

    const account = Object.values(getDb().accounts).find((a) => a.priceListId)!
    const corporateOrder = await newOrder(['cbc'])
    const corp = await labApi.billing.get(
      await desk.billing.create({
        orderId: corporateOrder,
        accountId: account.id,
      }),
    )
    expect(corp.lines[0]!.unitPrice).toBe(
      getDb().priceLists[account.priceListId!]!.prices.cbc,
    )
  })

  it('applies a small discount, holds a large one for approval', async () => {
    const id = await desk.billing.create({
      orderId: await newOrder(['lft', 'kft']),
    })
    const { gross } = (await labApi.billing.get(id)).totals
    const small = await desk.billing.requestDiscount(id, {
      amount: Math.floor(gross * 0.05),
      reason: 'Staff family',
    })
    expect(small.approved).toBe(true)

    const id2 = await desk.billing.create({
      orderId: await newOrder(['lipid', 'hba1c']),
    })
    const big = await desk.billing.requestDiscount(id2, {
      amount: 500,
      reason: 'Hardship',
    })
    expect(big.approved).toBe(false)
    await expect(
      desk.billing.pay(id2, { method: 'cash', amount: 100 }),
    ).rejects.toMatchObject({ code: 'discount-pending' })
    await expect(desk.billing.approveDiscount(id2, true)).rejects.toMatchObject(
      {
        code: 'not-permitted',
      },
    )
    await manager.billing.approveDiscount(id2, true)
    const after = await labApi.billing.get(id2)
    expect(after.totals.discount).toBe(500)
    expect(after.discount?.approvedByName).toBe('Ganesh Murthy')
  })

  it('needs references for card and UPI, and keeps accounts within their limit', async () => {
    const id = await desk.billing.create({ orderId: await newOrder(['cbc']) })
    const { total } = (await labApi.billing.get(id)).totals
    await expect(
      desk.billing.pay(id, { method: 'upi', amount: total }),
    ).rejects.toMatchObject({ code: 'reference-required' })
    await expect(
      desk.billing.pay(id, { method: 'cash', amount: total + 1 }),
    ).rejects.toMatchObject({ code: 'amount-invalid' })
    await desk.billing.pay(id, {
      method: 'upi',
      amount: total,
      reference: 'UPI123',
    })
    expect((await labApi.billing.get(id)).status).toBe('paid')

    const small = Object.values(getDb().accounts).find(
      (a) => a.kind === 'collection-centre',
    )!
    getDb().accounts[small.id]!.creditLimit = 1
    const onAccount = await desk.billing.create({
      orderId: await newOrder(['lipid']),
      accountId: small.id,
    })
    const owed = (await labApi.billing.get(onAccount)).totals.total
    await expect(
      desk.billing.pay(onAccount, { method: 'credit', amount: owed }),
    ).rejects.toMatchObject({ code: 'over-credit-limit' })
  })

  it('refunds no more than was received, and cancels only unpaid invoices', async () => {
    const id = await desk.billing.create({ orderId: await newOrder(['kft']) })
    const { total } = (await labApi.billing.get(id)).totals
    await desk.billing.pay(id, { method: 'cash', amount: total })
    await expect(
      desk.billing.cancel(id, 'Wrong patient'),
    ).rejects.toMatchObject({
      code: 'invoice-has-payments',
    })
    await expect(
      desk.billing.refund(id, { amount: 10, method: 'cash', reason: 'x' }),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await expect(
      manager.billing.refund(id, {
        amount: total + 1,
        method: 'cash',
        reason: 'x',
      }),
    ).rejects.toMatchObject({ code: 'refund-too-large' })
    await manager.billing.refund(id, {
      amount: total,
      method: 'cash',
      reason: 'Specimen rejected, patient declined recollection',
    })
    expect((await labApi.billing.get(id)).status).toBe('refunded')
  })

  it('closes the day against the payments, then takes no more cash', async () => {
    const id = await desk.billing.create({ orderId: await newOrder(['cbc']) })
    const { total } = (await labApi.billing.get(id)).totals
    await desk.billing.pay(id, { method: 'cash', amount: total })
    const book = await labApi.billing.dayBook()
    expect(book.expected.cash).toBeGreaterThanOrEqual(total)
    await expect(
      desk.billing.closeDay({
        counted: { ...book.expected, cash: book.expected.cash - 5 },
      }),
    ).rejects.toMatchObject({ code: 'reason-required' })
    await desk.billing.closeDay({ counted: book.expected })
    const closed = await labApi.billing.dayBook()
    expect(closed.close?.byName).toBe('Shruthi B')
    const id2 = await desk.billing.create({ orderId: await newOrder(['crp']) })
    await expect(
      desk.billing.pay(id2, { method: 'cash', amount: 10 }),
    ).rejects.toMatchObject({ code: 'day-closed' })
    expect(getDb().audit.some((a) => a.action === 'day-closed')).toBe(true)
  })

  it('seeds a realistic day: invoices, a pending discount and yesterday closed', async () => {
    const list = await labApi.billing.list({ date: '7d', pageSize: 200 })
    expect(list.page.total).toBeGreaterThan(20)
    expect(list.rows.some((r) => r.discountPending)).toBe(true)
    expect(list.counts.paid).toBeGreaterThan(0)
    const masters = await labApi.billing.masters()
    expect(masters.packages.map((p) => p.code).toSorted()).toEqual([
      'DIAB',
      'FEVER',
      'MHC',
    ])
    const yesterday = new Date(Date.now() - 86_400_000 + 330 * 60_000)
      .toISOString()
      .slice(0, 10)
    expect((await labApi.billing.dayBook(yesterday)).close).toBeDefined()
  })
})
