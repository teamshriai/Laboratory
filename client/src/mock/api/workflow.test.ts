import { beforeEach, describe, expect, it } from 'vitest'
import { startMemoryDb } from '../db/store'
import { labApi } from './index'
import { actingAs, STAFF } from './testing'

const reception = actingAs(STAFF.reception)
const manager = actingAs(STAFF.manager)
const pathologist = actingAs(STAFF.pathologist)
import { setActor } from './runtime'

describe('laboratory workflow (order to corrected report)', () => {
  beforeEach(() => {
    startMemoryDb()
    setActor('st_anjali')
  })

  it('moves a multi-department order through every stage', async () => {
    const { id: orderId, sampleIds } = await reception.orders.create({
      patientId: 'pat_002226',
      doctorId: 'dr_asha',
      department: 'general-medicine',
      encounter: 'OPD',
      priority: 'urgent',
      clinicalNotes: 'Fever for 3 days.',
      testIds: ['cbc', 'kft'],
    })
    expect(sampleIds).toHaveLength(2)

    let order = await labApi.orders.get(orderId)
    expect(order.status).toBe('new')
    const queue = await labApi.samples.collectionQueue()
    expect(queue.pending.some((s) => s.orderId === orderId)).toBe(true)

    const printed = await labApi.samples.printLabels(sampleIds)
    expect(
      printed.every((p) => /^LAB-\d{8}-\d{5}$/.test(p.accessionNo ?? '')),
    ).toBe(true)
    for (const id of sampleIds)
      await labApi.samples.collect(id, {
        collectedAt: Date.now(),
        site: 'left-antecubital',
      })
    expect((await labApi.orders.get(orderId)).status).toBe('collected')

    for (const p of printed) await labApi.samples.receive(p.accessionNo!)
    expect((await labApi.orders.get(orderId)).status).toBe('processing')

    const [cbcSample, kftSample] = sampleIds as [string, string]
    await labApi.samples.start(cbcSample, 'eq_xn1000')

    // Enter results: a critical potassium in the KFT.
    for (const sampleId of [cbcSample, kftSample]) {
      const view = await labApi.results.entry(sampleId)
      const entries = view.items.map((item) => ({
        itemId: item.itemId,
        values: Object.fromEntries(
          item.analytes.map((a) => {
            const value =
              a.analyte.id === 'k'
                ? '6.9'
                : a.range?.low !== null && a.range?.low !== undefined
                  ? String(a.range.low)
                  : '1'
            return [a.analyte.id, { value }]
          }),
        ),
      }))
      const saved = await labApi.results.save(sampleId, entries, true)
      if (sampleId === kftSample) expect(saved.newCriticals).toBe(1)
    }
    order = await labApi.orders.get(orderId)
    expect(order.status).toBe('awaiting-review')
    expect(order.openCriticals).toBe(1)

    // Technical review: the analyst cannot review their own results.
    const rows = (await labApi.validation.queue({ stage: 'review' })).filter(
      (r) => r.orderId === orderId,
    )
    const analyst = rows[0]!.enteredById!
    const ids = rows.map((r) => r.itemId)
    await expect(
      actingAs(analyst).validation.review(ids),
    ).rejects.toMatchObject({ code: 'self-review-not-allowed' })
    // Reception may not verify results at all.
    await expect(reception.validation.review(ids)).rejects.toMatchObject({
      code: 'not-permitted',
    })
    await manager.validation.review(ids)
    expect((await labApi.orders.get(orderId)).status).toBe(
      'awaiting-validation',
    )
    expect(
      (await labApi.validation.queue({ stage: 'authorise' })).filter(
        (r) => r.orderId === orderId,
      ),
    ).toHaveLength(rows.length)

    // Authorisation needs a pathologist.
    await expect(labApi.validation.validate(ids)).rejects.toMatchObject({
      code: 'not-permitted',
    })
    const validated = await pathologist.validation.validate(ids)
    expect(validated.readyReports).toHaveLength(2)
    // Authorised is not completed: completion needs the reports released.
    expect((await labApi.orders.get(orderId)).status).toBe('awaiting-release')

    // Release is blocked until the critical value is acknowledged.
    const bioReport = order.reports.find(
      (r) => r.department === 'biochemistry',
    )!
    const cbcReport = order.reports.find((r) => r.id !== bioReport.id)!
    await expect(
      pathologist.reports.release(bioReport.id),
    ).rejects.toMatchObject({ code: 'critical-unacknowledged' })
    const alert = (await labApi.critical.list({ status: 'pending' })).rows.find(
      (c) => c.orderId === orderId,
    )!
    await labApi.critical.document(alert.id, {
      notifiedTo: 'Dr. Asha Kiran',
      role: 'consultant',
      method: 'phone',
      notifiedAt: Date.now(),
      acknowledged: true,
      readBack: true,
    })
    await pathologist.reports.release(bioReport.id)
    expect((await labApi.orders.get(orderId)).status).toBe('partially-reported')
    await pathologist.reports.release(cbcReport.id)
    expect((await labApi.orders.get(orderId)).status).toBe('completed')
    let report = await labApi.reports.get(bioReport.id)
    expect(report.status).toBe('released')

    // Correction keeps the released value visible.
    const creat = report.sections
      .flatMap((s) => s.rows)
      .find((r) => r.analyteId === 'creat')!
    await pathologist.reports.correct(bioReport.id, {
      corrections: [{ resultId: creat.resultId, value: '1.42' }],
      reason: 'transcription-error',
      comments: 'Typed from wrong sample.',
    })
    report = await labApi.reports.get(bioReport.id)
    expect(report.status).toBe('corrected')
    expect(report.version).toBe(2)
    const corrected = report.sections
      .flatMap((s) => s.rows)
      .find((r) => r.analyteId === 'creat')!
    expect(corrected.value).toBe('1.42')
    expect(corrected.previousVersions).toEqual([
      expect.objectContaining({ version: 1, value: creat.value }),
    ])
  })

  it('requests a recollection when a sample is rejected', async () => {
    const { id: orderId, sampleIds } = await reception.orders.create({
      patientId: 'pat_002184',
      doctorId: 'dr_ramesh',
      department: 'general-medicine',
      encounter: 'OPD',
      priority: 'routine',
      clinicalNotes: '',
      testIds: ['cbc'],
    })
    const sampleId = sampleIds[0]!
    await labApi.samples.collect(sampleId, {
      collectedAt: Date.now(),
      site: 'left-antecubital',
    })
    await labApi.samples.receive(sampleId)
    const { recollectionId } = await labApi.samples.reject(sampleId, {
      reason: 'clotted-sample',
      remarks: 'Clots seen',
      recollect: true,
    })
    expect(recollectionId).toBeTruthy()
    const order = await labApi.orders.get(orderId)
    expect(order.status).toBe('new')
    expect(order.hasRecollection).toBe(true)
    const notifications = await labApi.notifications.list()
    expect(notifications.items[0]?.type).toMatch(
      /sample-rejected|recollection-requested/,
    )
  })

  it('adds a test to a collected sample and cancels another', async () => {
    const { id: orderId, sampleIds } = await reception.orders.create({
      patientId: 'pat_001742',
      doctorId: 'dr_nandini',
      department: 'endocrinology',
      encounter: 'OPD',
      priority: 'routine',
      clinicalNotes: '',
      testIds: ['thyroid'],
    })
    await labApi.samples.collect(sampleIds[0]!, {
      collectedAt: Date.now(),
      site: 'left-antecubital',
    })
    await reception.orders.addTests(orderId, ['crp'])
    let order = await labApi.orders.get(orderId)
    expect(order.items).toHaveLength(2)
    const crp = order.items.find((i) => i.testId === 'crp')!
    // Same bench and tube type: joins the sample already collected.
    expect(crp.sampleId).toBe(sampleIds[0])
    await reception.orders.removeTest(crp.itemId, 'doctor-request')
    order = await labApi.orders.get(orderId)
    expect(order.tests.filter((t) => t.active)).toHaveLength(1)
    expect(order.total).toBe(650)
  })
})
