// End-to-end scenarios against the real API: after each step, every screen's
// read model must tell the same story.

import { beforeEach, describe, expect, it } from 'vitest'
import { DAY } from '@/domain/time'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { setActor } from './runtime'

const PATHOLOGIST = 'st_kavitha'
const REVIEWER = 'st_ganesh'

async function enterAll(sampleId: string) {
  const view = await labApi.results.entry(sampleId)
  await labApi.results.save(
    sampleId,
    view.items.map((item) => ({
      itemId: item.itemId,
      values: Object.fromEntries(
        item.analytes.map((a) => [
          a.analyte.id,
          { value: a.analyte.options?.[0] ?? String(a.range?.low ?? 1) },
        ]),
      ),
    })),
    true,
  )
  return view.items.map((i) => i.itemId)
}

describe('scenarios', () => {
  beforeEach(() => {
    startMemoryDb()
    setActor('st_anjali')
  })

  it('A: registers a patient and follows one order to a released report', async () => {
    const { id: patientId, uhid } = await labApi.patients.register({
      name: 'Test Scenario Patient',
      sex: 'F',
      dob: '1990-04-12',
      mobile: '9000000001',
      allergies: [],
      city: 'Bengaluru',
      state: 'Karnataka',
      encounter: { type: 'OPD', department: 'general-medicine' },
    })
    expect((await labApi.search.query(uhid)).patients[0]?.id).toBe(patientId)

    const { id: orderId, sampleIds } = await labApi.orders.create({
      patientId,
      doctorId: 'dr_asha',
      department: 'general-medicine',
      encounter: 'OPD',
      priority: 'routine',
      clinicalNotes: '',
      testIds: ['cbc'],
    })
    const sampleId = sampleIds[0]!
    const inBucket = async (bucket: 'awaiting-collection' | 'completed') =>
      (await labApi.workQueue.list({ bucket })).rows.some(
        (r) => r.id === sampleId,
      )
    expect(await inBucket('awaiting-collection')).toBe(true)

    await labApi.samples.collect(sampleId, {
      collectedAt: Date.now(),
      collectedBy: 'st_kavya',
      site: 'left-antecubital',
    })
    const accession = (await labApi.samples.get(sampleId)).accessionNo!
    await labApi.samples.receive(accession)
    await labApi.samples.start(sampleId, 'eq_xn1000')
    const itemIds = await enterAll(sampleId)
    expect((await labApi.orders.get(orderId)).status).toBe('awaiting-review')

    await labApi.validation.review(itemIds, REVIEWER)
    await labApi.validation.validate(itemIds, PATHOLOGIST)
    const order = await labApi.orders.get(orderId)
    expect(order.status).toBe('completed')
    const reportId = order.reports[0]!.id
    await labApi.reports.release(reportId, PATHOLOGIST)

    // Every screen agrees.
    const report = await labApi.reports.get(reportId)
    expect(report.status).toBe('released')
    expect(report.reviewedBy).toBeTruthy()
    expect((await labApi.samples.get(sampleId)).status).toBe('completed')
    expect(await inBucket('completed')).toBe(true)
    const listed = await labApi.reports.list({ date: 'all', q: uhid })
    expect(listed.rows.map((r) => r.id)).toContain(reportId)
    const patient = await labApi.patients.get(patientId)
    expect(patient.orders.find((o) => o.id === orderId)?.status).toBe(
      'completed',
    )
    const trail = getDb().audit.filter(
      (a) => a.entityId === reportId || itemIds.includes(a.entityId),
    )
    expect(trail.map((a) => a.action)).toEqual(
      expect.arrayContaining(['released']),
    )
  })

  it('D: uses the lot that expires first when a run consumes reagent', async () => {
    const soon = await labApi.inventory.receiveLot({
      reagentId: 'rg_wdf',
      lotNumber: 'WDF-FEFO-1',
      quantity: 50,
      expiresAt: Date.now() + 3 * DAY,
      qcStatus: 'passed',
    })
    const { sampleIds } = await labApi.orders.create({
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
      collectedBy: 'st_kavya',
      site: 'left-antecubital',
    })
    await labApi.samples.receive(
      (await labApi.samples.get(sampleId)).accessionNo!,
    )
    await labApi.samples.start(sampleId, 'eq_xn1000')

    const lot = getDb().lots[soon]!
    expect(lot.quantity).toBe(49)
    expect(lot.transactions[0]).toMatchObject({ type: 'consume', quantity: -1 })
    const item = await labApi.inventory.item('reagent', 'rg_wdf')
    expect(item.movements.some((m) => m.type === 'consume')).toBe(true)
  })

  it('E: takes an analyzer offline, services it and brings it back', async () => {
    const { sampleIds } = await labApi.orders.create({
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
      collectedBy: 'st_kavya',
      site: 'left-antecubital',
    })
    await labApi.samples.receive(
      (await labApi.samples.get(sampleId)).accessionNo!,
    )

    await labApi.equipment.setConnection('eq_xn1000', {
      connection: 'offline',
      reason: 'Aspiration error',
    })
    expect((await labApi.equipment.get('eq_xn1000')).connection).toBe('offline')
    await expect(
      labApi.samples.start(sampleId, 'eq_xn1000'),
    ).rejects.toMatchObject({ code: 'analyzer-offline' })

    await labApi.equipment.scheduleMaintenance('eq_xn1000', {
      kind: 'corrective',
      dueAt: Date.now(),
      title: 'Clean aspiration probe',
      assignee: 'Sysmex service',
    })
    const task = (await labApi.equipment.get('eq_xn1000')).maintenancePlan.find(
      (t) => t.title === 'Clean aspiration probe',
    )!
    await labApi.equipment.completeMaintenance('eq_xn1000', {
      taskId: task.id,
      performedAt: Date.now() - 60_000,
      performedBy: 'Sysmex service',
      work: 'Probe cleaned and primed.',
      downtimeMin: 40,
      nextDueAt: Date.now() + 30 * DAY,
    })
    await labApi.equipment.setConnection('eq_xn1000', {
      connection: 'online',
      reason: 'Service complete',
    })
    await labApi.samples.start(sampleId, 'eq_xn1000')
    expect((await labApi.samples.get(sampleId)).status).toBe('processing')

    const actions = getDb()
      .audit.filter((a) => a.entityId === 'eq_xn1000')
      .map((a) => a.action)
    expect(actions).toEqual(
      expect.arrayContaining([
        'connection-offline',
        'connection-online',
        'maintenance-completed',
      ]),
    )
  })
})
