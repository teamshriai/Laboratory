// The audit's user journeys (§19 B to E; A is in scenarios.test.ts), each
// step through the API exactly as the screens call it, checking what every
// screen would show at that point.

import { beforeEach, describe, expect, it } from 'vitest'
import { translateEnum } from '@/i18n/core'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { actingAs, STAFF } from './testing'

const reception = actingAs(STAFF.reception)
const phlebotomist = actingAs(STAFF.phlebotomist)
const tech = actingAs(STAFF.biochemistry)
const manager = actingAs(STAFF.manager)
const pathologist = actingAs(STAFF.pathologist)

/** A new patient with one order, collected and received in the lab. */
async function receivedOrder(testIds: string[], name = 'Journey Patient') {
  const { id: patientId, uhid } = await reception.patients.register({
    name,
    sex: 'F',
    dob: '1985-06-20',
    mobile: '9000000123',
    allergies: [],
    city: 'Bengaluru',
    state: 'Karnataka',
    encounter: { type: 'OPD', department: 'general-medicine' },
  })
  const { id: orderId, sampleIds } = await reception.orders.create({
    patientId,
    doctorId: 'dr_asha',
    department: 'general-medicine',
    encounter: 'OPD',
    priority: 'routine',
    clinicalNotes: '',
    testIds,
  })
  const sampleId = sampleIds[0]!
  await phlebotomist.samples.collect(sampleId, {
    collectedAt: Date.now(),
    site: 'left-antecubital',
    identity: 'name-dob' as const,
    fasting: 'fasting' as const,
  })
  const accession = (await labApi.samples.get(sampleId)).accessionNo!
  await tech.samples.receive(accession)
  return { patientId, uhid, orderId, sampleId, accession }
}

/** Enters every analyte with `values[id]` or a value inside its interval. */
async function enter(sampleId: string, values: Record<string, string>) {
  const view = await labApi.results.entry(sampleId)
  const res = await tech.results.save(
    sampleId,
    view.items.map((item) => ({
      itemId: item.itemId,
      values: Object.fromEntries(
        item.analytes.map((a) => [
          a.analyte.id,
          {
            value:
              values[a.analyte.id] ??
              a.analyte.options?.[0] ??
              String(
                a.range?.low != null && a.range.high != null
                  ? (a.range.low + a.range.high) / 2
                  : 1,
              ),
          },
        ]),
      ),
    })),
    true,
  )
  return { itemIds: view.items.map((i) => i.itemId), ...res }
}

describe('audit journeys (§19)', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('B: patient search by UHID leads to every record and the report', async () => {
    const { patientId, uhid, orderId, sampleId } = await receivedOrder([
      'electrolytes',
    ])
    const { itemIds } = await enter(sampleId, {})
    await manager.validation.review(itemIds)
    await pathologist.validation.validate(itemIds)
    const reportId = (await labApi.orders.get(orderId)).reports[0]!.id
    await pathologist.reports.release(reportId)

    // A scanned or typed UHID opens the patient straight away.
    expect(await labApi.search.resolve(uhid)).toMatchObject({
      kind: 'patient',
      id: patientId,
    })
    // The patient page is the hub: orders, specimens, results, reports.
    const hub = await labApi.patients.get(patientId)
    expect(hub.orders.map((o) => o.id)).toContain(orderId)
    expect(hub.samples.map((s) => s.id)).toContain(sampleId)
    expect(hub.reports.map((r) => r.id)).toContain(reportId)
    expect(hub.results.length).toBeGreaterThan(0)
    // Every timeline entry links somewhere real; none dead-ends.
    const links = hub.timeline.map((x) => x.link)
    expect(links.every((l) => typeof l === 'string' && l.startsWith('/'))).toBe(
      true,
    )
    expect(links).toContain(`/reports/${reportId}`)
    const report = await labApi.reports.get(reportId)
    expect(report.patient.uhid).toBe(uhid)
  })

  it('C: an abnormal value is flagged from the stored interval and verified first', async () => {
    const { sampleId } = await receivedOrder(['electrolytes'])
    await enter(sampleId, { na: '150' })
    const view = await labApi.results.entry(sampleId)
    const na = view.items[0]!.analytes.find((a) => a.analyte.id === 'na')!
    // The flag comes from the interval stored with the result.
    expect(na.result?.range?.high).toBeLessThan(150)
    expect(na.result?.flag).toBe('HIGH')
    expect(translateEnum('en', 'flagShort', 'HIGH')).toBe('H')

    const queue = await labApi.validation.queue({ stage: 'review' })
    const mine = queue.findIndex((r) => r.sampleId === sampleId)
    expect(mine).toBeGreaterThanOrEqual(0)
    expect(queue[mine]!.abnormalCount).toBe(1)
    // Abnormal and critical work comes before anything normal.
    const firstNormal = queue.findIndex(
      (r) => r.abnormalCount === 0 && r.criticalCount === 0,
    )
    expect(firstNormal === -1 || mine < firstNormal).toBe(true)
  })

  it('D: a critical value is shown first, needs a full-name read-back call, then releases', async () => {
    const before = (await labApi.critical.list({ status: 'pending' })).counts
      .pending
    const { orderId, sampleId } = await receivedOrder(['electrolytes'])
    const { itemIds, newCriticals } = await enter(sampleId, { k: '6.9' })
    expect(newCriticals).toBe(1)

    // The dashboard tile and the critical list both count it.
    const pending = await labApi.critical.list({ status: 'pending' })
    expect(pending.counts.pending).toBe(before + 1)
    const alert = pending.rows.find((r) => r.sampleId === sampleId)!
    // Shown as HH in words, not by colour alone.
    expect(alert.flag).toBe('CRITICAL_HIGH')
    expect(translateEnum('en', 'flagShort', 'CRITICAL_HIGH')).toBe('HH')

    await manager.validation.review(itemIds)
    await pathologist.validation.validate(itemIds)
    const reportId = (await labApi.orders.get(orderId)).reports[0]!.id
    // Lab policy holds the release until the call is logged.
    await expect(pathologist.reports.release(reportId)).rejects.toMatchObject({
      code: 'critical-unacknowledged',
    })

    const call = {
      role: 'consultant' as const,
      method: 'phone' as const,
      notifiedAt: Date.now(),
      acknowledged: true,
      readBack: true,
    }
    // A first name alone is not enough to identify who was told.
    await expect(
      tech.critical.document(alert.id, { ...call, notifiedTo: 'Asha' }),
    ).rejects.toMatchObject({ code: 'recipient-full-name' })
    // A phone call cannot be acknowledged without read-back.
    await expect(
      tech.critical.document(alert.id, {
        ...call,
        notifiedTo: 'Dr. Asha Kiran',
        readBack: false,
      }),
    ).rejects.toBeTruthy()
    await tech.critical.document(alert.id, {
      ...call,
      notifiedTo: 'Dr. Asha Kiran',
    })
    const done = await labApi.critical.get(alert.id)
    expect(done.status).toBe('acknowledged')
    expect(done.notifiedBy).toBe(STAFF.biochemistry)

    await pathologist.reports.release(reportId)
    const report = await labApi.reports.get(reportId)
    expect(report.criticals[0]).toMatchObject({
      notifiedTo: 'Dr. Asha Kiran',
      readBack: true,
    })
    const trail = getDb().audit.filter((a) => a.entityId === alert.id)
    expect(trail.length).toBeGreaterThan(0)
  })

  it('E: a rejected specimen creates a linked recollection and the order stays open', async () => {
    const { orderId, sampleId, accession } = await receivedOrder([
      'electrolytes',
    ])
    const { recollectionId } = await tech.samples.reject(sampleId, {
      reason: 'hemolyzed-sample',
      recollect: true,
    })
    expect(recollectionId).toBeTruthy()

    const order = await labApi.orders.get(orderId)
    expect(order.status).not.toBe('completed')
    expect(order.status).not.toBe('cancelled')
    // The recollection is on the collection list, linked to the rejected one.
    const due = await labApi.workQueue.list({ bucket: 'recollection' })
    expect(due.rows.map((r) => r.id)).toContain(recollectionId)
    expect(getDb().samples[recollectionId!]!.recollectionOfId).toBe(sampleId)

    await phlebotomist.samples.collect(recollectionId!, {
      collectedAt: Date.now(),
      site: 'left-antecubital',
      identity: 'name-dob' as const,
      fasting: 'fasting' as const,
    })
    const fresh = (await labApi.samples.get(recollectionId!)).accessionNo!
    expect(fresh).not.toBe(accession)
    await tech.samples.receive(fresh)
    await enter(recollectionId!, {})
    expect((await labApi.samples.get(recollectionId!)).status).toBe(
      'processing',
    )
  })
})
