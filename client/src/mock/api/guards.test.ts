// The safety rules from the laboratory audit (improvemet.md §8-§9), each
// tried the wrong way first and then the right way.

import { beforeEach, describe, expect, it } from 'vitest'
import { DAY, MINUTE } from '@/domain/time'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { setActor } from './runtime'
import { actingAs, STAFF } from './testing'

const reception = actingAs(STAFF.reception)
const phlebotomist = actingAs(STAFF.phlebotomist)
const manager = actingAs(STAFF.manager)
const pathologist = actingAs(STAFF.pathologist)
const microbiologist = actingAs(STAFF.microbiologist)

async function order(testIds: string[], patientId = 'pat_002184') {
  return reception.orders.create({
    patientId,
    doctorId: 'dr_ramesh',
    department: 'general-medicine',
    encounter: 'OPD',
    priority: 'routine',
    clinicalNotes: '',
    testIds,
  })
}

async function received(testId: string) {
  const { id: orderId, sampleIds } = await order([testId])
  const sampleId = sampleIds[0]!
  await labApi.samples.collect(sampleId, {
    collectedAt: Date.now(),
    site: 'left-antecubital',
  })
  await labApi.samples.receive(sampleId)
  return { orderId, sampleId }
}

async function enter(
  sampleId: string,
  overrides: Record<string, string> = {},
  changeReason?: string,
) {
  const view = await labApi.results.entry(sampleId)
  const open = view.items.filter((i) => i.status !== 'validated')
  await labApi.results.save(
    sampleId,
    open.map((item) => ({
      itemId: item.itemId,
      ...(changeReason ? { changeReason } : {}),
      values: Object.fromEntries(
        item.analytes.map((a) => [
          a.analyte.id,
          {
            value:
              overrides[a.analyte.id] ??
              a.analyte.options?.[0] ??
              String(a.range?.low ?? 1),
          },
        ]),
      ),
    })),
    true,
  )
  return open.map((i) => i.itemId)
}

describe('safety rules', () => {
  beforeEach(() => {
    startMemoryDb()
    setActor(STAFF.technician)
  })

  it('lets each role do only its own work (audit §5)', async () => {
    const { sampleId } = await received('kft')
    await expect(
      reception.results.save(sampleId, [], true),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    const { sampleIds } = await order(['cbc'])
    await phlebotomist.samples.collect(sampleIds[0]!, {
      collectedAt: Date.now(),
      site: 'left-antecubital',
    })
    await expect(
      phlebotomist.samples.receive(sampleIds[0]!),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    const itemIds = await enter(sampleId)
    await manager.validation.review(itemIds)
    await expect(labApi.validation.validate(itemIds)).rejects.toMatchObject({
      code: 'not-permitted',
    })
    // A microbiologist authorises microbiology only.
    await expect(
      microbiologist.validation.validate(itemIds),
    ).rejects.toMatchObject({ code: 'outside-discipline' })
    await pathologist.validation.validate(itemIds)
  })

  it('keeps work on record: cancel before receipt, tests until resulted', async () => {
    const { orderId, sampleId } = await received('kft')
    await expect(
      reception.orders.cancel(orderId, { reason: 'doctor-request' }),
    ).rejects.toMatchObject({ code: 'order-in-lab' })
    await expect(
      reception.orders.cancel(orderId, { reason: 'other' }),
    ).rejects.toMatchObject({ code: 'reason-required' })
    const [itemId] = await enter(sampleId)
    await expect(
      reception.orders.removeTest(itemId!, 'doctor-request'),
    ).rejects.toMatchObject({ code: 'test-resulted' })

    const fresh = await order(['cbc'])
    await reception.orders.cancel(fresh.id, { reason: 'duplicate-order' })
    const cancelled = getDb().orders[fresh.id]!
    expect(cancelled.cancelledBy).toBe(STAFF.reception)
    expect(cancelled.cancelledAt).toBeGreaterThan(0)
  })

  it('keeps specimen times in order (D5, D6)', async () => {
    const { sampleIds } = await order(['cbc'])
    const id = sampleIds[0]!
    await expect(
      labApi.samples.collect(id, {
        collectedAt: Date.now() + 5 * MINUTE,
        site: 'left-antecubital',
      }),
    ).rejects.toMatchObject({ code: 'collection-in-future' })
    await expect(
      labApi.samples.collect(id, {
        collectedAt: Date.now() - DAY,
        site: 'left-antecubital',
        timeReason: 'Recorded late',
      }),
    ).rejects.toMatchObject({ code: 'collection-before-order' })
    await labApi.samples.collect(id, {
      collectedAt: Date.now(),
      site: 'left-antecubital',
    })
    const sample = getDb().samples[id]!
    expect(sample.collectedBy).toBe(STAFF.technician)
    expect(
      getDb().audit.some((a) => a.entityId === id && a.action === 'collected'),
    ).toBe(true)
  })

  it('refuses impossible values and asks why a submitted value changes', async () => {
    const { sampleId } = await received('kft')
    await expect(enter(sampleId, { k: '69' })).rejects.toMatchObject({
      code: 'implausible-value',
    })
    await expect(enter(sampleId, { k: 'high' })).rejects.toMatchObject({
      code: 'not-numeric',
    })
    await enter(sampleId, { k: '4.5' })
    await expect(enter(sampleId, { k: '4.6' })).rejects.toMatchObject({
      code: 'reason-required',
    })
    await enter(sampleId, { k: '4.6' }, 'Typed 4.5 from the analyzer screen')
    const items = new Set(
      Object.values(getDb().items)
        .filter((i) => i.sampleId === sampleId)
        .map((i) => i.id),
    )
    const result = Object.values(getDb().results).find(
      (r) => items.has(r.orderItemId) && r.analyteId === 'k',
    )!
    expect(result.value).toBe('4.6')
    expect(result.revisions.at(-1)).toMatchObject({
      value: '4.5',
      reason: 'Typed 4.5 from the analyzer screen',
    })
    expect(result.source).toBe('manual')
    expect(
      getDb().audit.find((a) => a.action === 'value-changed'),
    ).toMatchObject({ from: '4.5', to: '4.6' })
  })

  it('reruns a test keeping both values', async () => {
    const { sampleId } = await received('kft')
    const [itemId] = await enter(sampleId, { k: '6.9' })
    await expect(
      labApi.results.rerun(itemId!, { reason: ' ' }),
    ).rejects.toMatchObject({ code: 'reason-required' })
    await labApi.results.rerun(itemId!, {
      reason: 'Haemolysis suspected, repeat on the same specimen',
    })
    expect(getDb().items[itemId!]!.status).toBe('draft')
    await enter(sampleId, { k: '4.4' })
    const k = Object.values(getDb().results).find(
      (r) => r.orderItemId === itemId && r.analyteId === 'k',
    )!
    expect(k.value).toBe('4.4')
    expect(k.revisions.at(-1)).toMatchObject({ value: '6.9', rerun: true })
  })

  it('blocks authorisation while QC has failed on the analyzer', async () => {
    const { sampleId } = await received('cbc')
    await labApi.samples.start(sampleId, 'eq_xn1000')
    const itemIds = await enter(sampleId)
    await manager.validation.review(itemIds)
    const qc = await labApi.qc.get()
    const lot = qc.controlLots.find((c) => c.equipmentId === 'eq_xn1000')!
    await labApi.qc.record({
      equipmentId: lot.equipmentId,
      analyteId: lot.analyteId,
      level: lot.level,
      value: lot.mean + lot.sd * 3.6,
    })
    await expect(
      pathologist.validation.validate(itemIds),
    ).rejects.toMatchObject({ code: 'qc-hold' })
  })

  it('releases preliminary, then final; completes only when all is final', async () => {
    const { id: orderId, sampleIds } = await order(['lft', 'kft'])
    const sampleId = sampleIds[0]!
    await labApi.samples.collect(sampleId, {
      collectedAt: Date.now(),
      site: 'left-antecubital',
    })
    await labApi.samples.receive(sampleId)
    const view = await labApi.results.entry(sampleId)
    const lft = view.items.find((i) => i.testName.includes('Liver'))!
    await labApi.results.save(
      sampleId,
      [
        {
          itemId: lft.itemId,
          values: Object.fromEntries(
            lft.analytes.map((a) => [
              a.analyte.id,
              { value: String(a.range?.low ?? 1) },
            ]),
          ),
        },
      ],
      true,
    )
    await manager.validation.review([lft.itemId])
    await pathologist.validation.validate([lft.itemId])
    const reportId = getDb().items[lft.itemId]!.reportId
    await expect(pathologist.reports.release(reportId)).rejects.toMatchObject({
      code: 'report-not-validated',
    })
    await pathologist.reports.release(reportId, { preliminary: true })
    expect((await labApi.reports.get(reportId)).status).toBe('preliminary')
    expect((await labApi.orders.get(orderId)).status).toBe('partially-reported')

    const rest = await enter(sampleId)
    const pending = rest.filter((id) => id !== lft.itemId)
    await manager.validation.review(pending)
    await pathologist.validation.validate(pending)
    await pathologist.reports.release(reportId)
    const report = await labApi.reports.get(reportId)
    expect(report.status).toBe('released')
    expect(report.versions.map((v) => v.kind)).toEqual(['preliminary', 'final'])
    expect((await labApi.orders.get(orderId)).status).toBe('completed')

    await expect(
      pathologist.reports.withdraw(reportId, ''),
    ).rejects.toMatchObject({ code: 'reason-required' })
    await pathologist.reports.withdraw(reportId, 'Issued for the wrong patient')
    expect((await labApi.reports.get(reportId)).status).toBe('withdrawn')
    expect((await labApi.orders.get(orderId)).status).not.toBe('completed')
  })

  it('warns about a likely duplicate patient and checks the date of birth', async () => {
    const existing = Object.values(getDb().patients)[0]!
    const input = {
      name: existing.name,
      sex: existing.sex,
      dob: existing.dob,
      mobile: '9000000002',
      allergies: [],
      city: 'Bengaluru',
      state: 'Karnataka',
      encounter: {
        type: 'OPD' as const,
        department: 'general-medicine' as const,
      },
    }
    await expect(reception.patients.register(input)).rejects.toMatchObject({
      code: 'possible-duplicate',
      params: { uhid: existing.uhid },
    })
    await reception.patients.register({
      ...input,
      duplicateReason: 'Different person: father and son, same name',
    })
    await expect(
      reception.patients.register({ ...input, dob: '2999-01-01' }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
  })

  it('records a critical call only with the full name of the person reached', async () => {
    const { sampleId } = await received('kft')
    await enter(sampleId, { k: '6.9' })
    const alert = Object.values(getDb().criticals).find(
      (c) => c.sampleId === sampleId,
    )!
    const call = {
      role: 'consultant' as const,
      method: 'phone' as const,
      notifiedAt: Date.now(),
      acknowledged: true,
      readBack: true,
    }
    await expect(
      labApi.critical.document(alert.id, { ...call, notifiedTo: 'Dr. Asha' }),
    ).rejects.toMatchObject({ code: 'recipient-full-name' })
    await labApi.critical.document(alert.id, {
      ...call,
      notifiedTo: 'Dr. Asha Kiran',
    })
    expect(getDb().criticals[alert.id]!.status).toBe('acknowledged')
  })

  it('changes the catalog only with a reason, and versions it', async () => {
    const test = Object.values(getDb().tests)[0]!
    await expect(
      manager.catalog.update(test.id, { price: test.price + 10 }, ''),
    ).rejects.toMatchObject({ code: 'reason-required' })
    await expect(
      labApi.catalog.update(test.id, { price: test.price + 10 }, 'New tariff'),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await manager.catalog.update(
      test.id,
      { price: test.price + 10 },
      'New tariff from 1 October',
    )
    expect(getDb().tests[test.id]!.version).toBe((test.version ?? 1) + 1)
    await expect(
      manager.catalog.saveRanges(
        'k',
        {
          ranges: [
            { sex: 'any', ageMin: 0, ageMax: 50, low: 3.5, high: 5.1 },
            { sex: 'any', ageMin: 40, ageMax: 120, low: 3.6, high: 5.2 },
          ],
        },
        'Method change',
      ),
    ).rejects.toMatchObject({ code: 'validation-failed' })
  })

  it('lets only the lab manager reset the demo data, and records it', async () => {
    await expect(labApi.system.reset()).rejects.toMatchObject({
      code: 'not-permitted',
    })
    await manager.system.reset()
    expect(getDb().audit[0]).toMatchObject({
      entity: 'system',
      action: 'reset',
      by: STAFF.manager,
    })
  })
})
