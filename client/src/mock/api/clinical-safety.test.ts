// The research pack's clinical-safety rules (Wave 1), each with the rule and
// its refusal: consent before collection, two-identifier identity, fasting
// status, deferred collection, add-on stability, aliquots, send-outs,
// receipt temperature, the signatory registry, patient merge and identifier
// checks, calculated values and critical escalation.

import { beforeEach, describe, expect, it } from 'vitest'
import { DAY, HOUR } from '@/domain/time'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { actingAs, STAFF } from './testing'

const reception = actingAs(STAFF.reception)
const phlebotomist = actingAs(STAFF.phlebotomist)
const tech = actingAs(STAFF.biochemistry)
const manager = actingAs(STAFF.manager)
const pathologist = actingAs(STAFF.pathologist)

const collectInput = {
  site: 'left-antecubital' as const,
  identity: 'name-uhid' as const,
  fasting: 'fasting' as const,
}

async function newOrder(testIds: string[], name = 'Safety Patient') {
  const { id: patientId } = await reception.patients.register({
    name,
    sex: 'M',
    dob: '1979-02-11',
    mobile: '+91 98450 00111',
    allergies: [],
    city: 'Chennai',
    state: 'Tamil Nadu',
    encounter: { type: 'OPD', department: 'general-medicine' },
  })
  const order = await reception.orders.create({
    patientId,
    doctorId: 'dr_asha',
    department: 'general-medicine',
    encounter: 'OPD',
    priority: 'routine',
    clinicalNotes: '',
    testIds,
  })
  return { patientId, ...order }
}

describe('collection safety', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('needs two identifiers and, for fasting tests, the fasting status', async () => {
    const { sampleIds } = await newOrder(['fbs'])
    const id = sampleIds[0]!
    // What arrives over the network is not typed: an unknown method is
    // refused by the engine, not trusted.
    const untypedCollect = phlebotomist.samples.collect as (
      id: string,
      input: unknown,
    ) => Promise<unknown>
    await expect(
      untypedCollect(id, {
        collectedAt: Date.now(),
        site: 'left-antecubital',
        identity: 'guess',
      }),
    ).rejects.toMatchObject({ code: 'identity-not-confirmed' })
    await expect(
      phlebotomist.samples.collect(id, {
        collectedAt: Date.now(),
        site: 'left-antecubital',
        identity: 'name-dob',
      }),
    ).rejects.toMatchObject({ code: 'fasting-status-required' })
    await phlebotomist.samples.collect(id, {
      collectedAt: Date.now(),
      ...collectInput,
    })
    const sample = await labApi.samples.get(id)
    expect(sample.identityCheck?.method).toBe('name-uhid')
    expect(sample.fastingStatus).toBe('fasting')
  })

  it('does not collect a test that needs consent until it is recorded', async () => {
    const { patientId, sampleIds } = await newOrder(['hiv'])
    const id = sampleIds[0]!
    const before = await labApi.samples.get(id)
    expect(before.consentMissing.map((m) => m.testName)).toEqual([
      'HIV 1 & 2 Antibody',
    ])
    await expect(
      phlebotomist.samples.collect(id, {
        collectedAt: Date.now(),
        ...collectInput,
      }),
    ).rejects.toMatchObject({ code: 'consent-required' })
    // Verbal consent needs a witness's full name.
    await expect(
      phlebotomist.patients.recordConsent(patientId, {
        purpose: 'test-procedure',
        status: 'granted',
        method: 'verbal-witnessed',
        language: 'ta',
        at: Date.now(),
        witness: 'Priya',
        orderItemIds: before.consentMissing.map((m) => m.itemId),
      }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
    await phlebotomist.patients.recordConsent(patientId, {
      purpose: 'test-procedure',
      status: 'granted',
      method: 'verbal-witnessed',
      language: 'ta',
      at: Date.now(),
      witness: 'Priya Natarajan',
      orderItemIds: before.consentMissing.map((m) => m.itemId),
    })
    expect((await labApi.samples.get(id)).consentMissing).toEqual([])
    await phlebotomist.samples.collect(id, {
      collectedAt: Date.now(),
      ...collectInput,
    })
    const detail = await labApi.patients.get(patientId)
    expect(detail.consents[0]).toMatchObject({
      purpose: 'test-procedure',
      status: 'granted',
      witness: 'Priya Natarajan',
    })
  })

  it('takes a deferred collection early only with a reason', async () => {
    const { sampleIds } = await newOrder(['ppbs'])
    const id = sampleIds[0]!
    await phlebotomist.samples.schedule(id, {
      at: Date.now() + 2 * HOUR,
      reason: 'Two hours after breakfast',
    })
    await expect(
      phlebotomist.samples.collect(id, {
        collectedAt: Date.now(),
        ...collectInput,
      }),
    ).rejects.toMatchObject({ code: 'collection-scheduled' })
    await phlebotomist.samples.collect(id, {
      collectedAt: Date.now(),
      ...collectInput,
      timeReason: 'Patient leaving early; doctor informed',
    })
  })

  it('records the receipt temperature and flags a deviation', async () => {
    const { sampleIds } = await newOrder(['lipid'])
    const id = sampleIds[0]!
    await phlebotomist.samples.collect(id, {
      collectedAt: Date.now(),
      ...collectInput,
    })
    const accession = (await labApi.samples.get(id)).accessionNo!
    const received = await tech.samples.receive(accession, {
      temperature: 'out-of-range',
    })
    expect(received.temperatureDeviation).toBe(true)
    const sample = await labApi.samples.get(id)
    expect(sample.receiptTemperature).toBe('out-of-range')
  })
})

describe('specimens in the lab', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  async function received(testIds: string[]) {
    const order = await newOrder(testIds)
    const id = order.sampleIds[0]!
    await phlebotomist.samples.collect(id, {
      collectedAt: Date.now(),
      ...collectInput,
    })
    const accession = (await labApi.samples.get(id)).accessionNo!
    await tech.samples.receive(accession, { temperature: 'chilled' })
    return { ...order, id, accession }
  }

  it('splits a specimen into traced aliquots, keeping one test on the original', async () => {
    const { id, accession } = await received(['lft', 'kft'])
    const items = Object.values(getDb().items).filter((i) => i.sampleId === id)
    expect(items.length).toBeGreaterThanOrEqual(2)
    await expect(
      tech.samples.split(id, [items.map((i) => i.id)]),
    ).rejects.toMatchObject({ code: 'cannot-split' })
    const [aliquot] = await tech.samples.split(id, [[items[1]!.id]])
    expect(aliquot!.accessionNo).toBe(`${accession}-01`)
    const parent = await labApi.samples.get(id)
    expect(parent.aliquots.map((a) => a.accessionNo)).toEqual([
      `${accession}-01`,
    ])
    const child = await labApi.samples.get(aliquot!.id)
    expect(child.parent?.accessionNo).toBe(accession)
    expect(child.tests).toHaveLength(1)
  })

  it('sends a specimen to a referral lab and names it on the report', async () => {
    const { id } = await received(['ana'])
    await expect(
      phlebotomist.samples.sendOut(id, { labId: 'rl_kaveri' }),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await tech.samples.sendOut(id, { labId: 'rl_kaveri', courier: 'Blue Dart' })
    await expect(
      tech.samples.updateSendOut(id, { state: 'dispatched' }),
    ).rejects.toMatchObject({ code: 'send-out-state' })
    await tech.samples.updateSendOut(id, {
      state: 'resulted',
      externalRef: 'KRL-2610-4471',
    })
    const sample = await labApi.samples.get(id)
    expect(sample.sendOut).toMatchObject({
      labName: 'Kaveri Reference Laboratory',
      state: 'resulted',
      nablAccredited: true,
    })
    const item = Object.values(getDb().items).find((i) => i.sampleId === id)!
    const report = await labApi.reports.get(item.reportId)
    const section = report.sections.find((s) => s.itemId === item.id)!
    expect(section.performedBy?.name).toBe('Kaveri Reference Laboratory')
    // ANA is outside this lab's own NABL scope: the report says so.
    expect(section.notAccredited).toBe(true)
  })

  it('gives an add-on past the stability window a new specimen', async () => {
    const { id: orderId, id: sampleId } = await received(['kft'])
    const order = Object.values(getDb().orders).find((o) =>
      Object.values(getDb().samples).some(
        (s) => s.id === sampleId && s.orderId === o.id,
      ),
    )!
    void orderId
    // Make the drawn specimen older than any serum test's stability.
    getDb().samples[sampleId]!.collectedAt = Date.now() - 5 * DAY
    const fresh = await reception.orders.addTests(order.id, ['calcium'])
    expect(fresh).toEqual(['Calcium'])
    const added = Object.values(getDb().items).find(
      (i) => i.orderId === order.id && i.testId === 'calcium',
    )!
    expect(added.sampleId).not.toBe(sampleId)
    expect(getDb().samples[added.sampleId!]!.status).toBe('pending_collection')
  })
})

describe('results and authorisation', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('calculates LDL and refuses Friedewald above TG 400', async () => {
    const order = await newOrder(['lipid'])
    const id = order.sampleIds[0]!
    await phlebotomist.samples.collect(id, {
      collectedAt: Date.now(),
      ...collectInput,
    })
    await tech.samples.receive((await labApi.samples.get(id)).accessionNo!)
    const view = await labApi.results.entry(id)
    const item = view.items[0]!
    const save = (tg: string) =>
      tech.results.save(
        id,
        [
          {
            itemId: item.itemId,
            values: {
              tc: { value: '220' },
              hdl: { value: '40' },
              tg: { value: tg },
              // A typed LDL is ignored: the system computes it.
              ldl: { value: '999' },
            },
          },
        ],
        false,
      )
    await save('150')
    const ldl = () =>
      Object.values(getDb().results).find(
        (r) => r.orderItemId === item.itemId && r.analyteId === 'ldl',
      )
    expect(ldl()?.value).toBe('150')
    expect(ldl()?.calculated).toBe(true)
    await save('450')
    expect(ldl()?.value).toBeNull()
  })

  it('lets only a registered signatory authorise', async () => {
    const db = getDb()
    const item = Object.values(db.items).find(
      (i) => i.status === 'reviewed' && i.department !== 'microbiology',
    )!
    await manager.admin.updateSignatory(STAFF.pathologist, {
      registrationNo: 'KMC 68214',
      council: 'Karnataka Medical Council',
      departments: ['microbiology'],
      active: true,
    })
    await expect(
      pathologist.validation.validate([item.id]),
    ).rejects.toMatchObject({ code: 'not-a-signatory' })
    await expect(
      pathologist.admin.updateSignatory(STAFF.pathologist, null),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await manager.admin.updateSignatory(STAFF.pathologist, {
      registrationNo: 'KMC 68214',
      council: 'Karnataka Medical Council',
      departments: [item.department],
      active: true,
    })
    await pathologist.validation.validate([item.id])
    expect(getDb().items[item.id]!.status).toBe('validated')
    expect(getDb().audit.some((a) => a.action === 'signatory-updated')).toBe(
      true,
    )
  })

  it('names who a late critical value escalates to', async () => {
    const pending = (await labApi.critical.list({ status: 'pending', q: '' }))
      .rows
    expect(pending.length).toBeGreaterThan(0)
    const tiers = getDb().settings.criticalEscalation
    for (const row of pending) {
      const minutes = (Date.now() - row.detectedAt) / 60_000
      const reached = tiers.filter((t) => minutes >= t.afterMin).at(-1)
      expect(row.escalationDue?.to).toBe(reached?.to)
    }
  })
})

describe('patients', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('checks mobile, PIN and ABHA, and never asks for Aadhaar', async () => {
    const base = {
      name: 'Identifier Check',
      sex: 'F' as const,
      dob: '1990-05-05',
      allergies: [],
      city: 'Madurai',
      state: 'Tamil Nadu',
      encounter: {
        type: 'OPD' as const,
        department: 'general-medicine' as const,
      },
    }
    await expect(
      reception.patients.register({ ...base, mobile: '5123456789' }),
    ).rejects.toMatchObject({ code: 'invalid-mobile' })
    await expect(
      reception.patients.register({
        ...base,
        mobile: '9876543210',
        pinCode: '06001',
      }),
    ).rejects.toMatchObject({ code: 'invalid-pin' })
    await expect(
      reception.patients.register({
        ...base,
        mobile: '9876543210',
        abha: { number: '1234' },
      }),
    ).rejects.toMatchObject({ code: 'invalid-abha' })
    const { id } = await reception.patients.register({
      ...base,
      mobile: '09876543210'.slice(1),
      pinCode: '625001',
      abha: { number: '12345678901234', address: 'priya.k@abdm' },
    })
    const p = getDb().patients[id]!
    expect(p.mobile).toBe('+91 98765 43210')
    expect(p.abha).toEqual({
      number: '12-3456-7890-1234',
      address: 'priya.k@abdm',
    })
    expect(JSON.stringify(p).toLowerCase()).not.toContain('aadhaar')
  })

  it('merges a duplicate into the record that stays, audited', async () => {
    const a = await newOrder(['cbc'], 'Merge Survivor')
    const b = await newOrder(['kft'], 'Merge Duplicate')
    await expect(
      phlebotomist.patients.merge({
        survivorId: a.patientId,
        duplicateId: b.patientId,
        reason: 'Registered twice',
      }),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await reception.patients.merge({
      survivorId: a.patientId,
      duplicateId: b.patientId,
      reason: 'Registered twice at the front desk',
    })
    const db = getDb()
    expect(db.patients[b.patientId]!.mergedInto).toBe(a.patientId)
    expect(db.orders[b.id]!.patientId).toBe(a.patientId)
    const list = await labApi.patients.list({ q: 'Merge' })
    expect(list.rows.map((r) => r.id)).toEqual([a.patientId])
    await expect(
      reception.patients.update(b.patientId, { city: 'Salem' }),
    ).rejects.toMatchObject({ code: 'patient-merged' })
    expect(db.audit.filter((e) => e.action.startsWith('merged')).length).toBe(2)
  })
})
