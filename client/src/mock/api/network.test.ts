// The lab's network: the doctor portal sees only its own patients, revenue
// shows only to roles that may see it, home visits follow their states with
// proof, and messages are recorded as not sent (no gateway) or opted out.

import { beforeEach, describe, expect, it } from 'vitest'
import { HOUR } from '@/domain/time'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { actingAs, STAFF } from './testing'

const desk = actingAs(STAFF.reception)
const manager = actingAs(STAFF.manager)
const phlebotomist = actingAs(STAFF.phlebotomist)
const doctor = actingAs('st_dr_asha')
const owner = actingAs('st_vasanth')

describe('network, portals and messaging', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('shows a doctor only their own patients and refuses others as not found', async () => {
    const list = await doctor.doctor.patients({ pageSize: 200 })
    expect(list.doctorName).toBe('Dr. Asha Kiran')
    expect(list.rows.length).toBeGreaterThan(0)
    const db = getDb()
    for (const row of list.rows)
      expect(
        Object.values(db.orders).some(
          (o) => o.patientId === row.patient.id && o.doctorId === 'dr_asha',
        ),
      ).toBe(true)

    const mine = list.rows[0]!.patient.id
    const detail = await doctor.doctor.patient(mine)
    expect(detail.reports.every((r) => r.status === 'released')).toBe(true)

    const other = Object.values(db.patients).find(
      (p) =>
        !Object.values(db.orders).some(
          (o) => o.patientId === p.id && o.doctorId === 'dr_asha',
        ),
    )!
    await expect(doctor.doctor.patient(other.id)).rejects.toMatchObject({
      code: 'not-found',
    })
    await expect(
      actingAs(STAFF.technician).doctor.patients(),
    ).rejects.toMatchObject({ code: 'not-permitted' })
  })

  it('shows revenue to the owner and leaves it out for a technician', async () => {
    const forTech = await actingAs(STAFF.technician).analytics.report({
      preset: '7d',
    })
    expect(forTech.totals.revenue).toBeNull()
    const forOwner = await owner.analytics.report({ preset: '7d' })
    expect(forOwner.totals.revenue).toBeGreaterThan(0)
  })

  it('seeds the masters: outside referrers, centres and templates', async () => {
    const masters = await labApi.network.masters()
    expect(masters.doctors.filter((d) => d.external)).toHaveLength(2)
    expect(masters.centres.map((c) => c.code).toSorted()).toEqual([
      'CC-HOS',
      'CC-HSR',
      'CC-MYS',
    ])
    expect(masters.centres.find((c) => c.code === 'CC-HOS')?.accountName).toBe(
      'Arogya Collection Point, Hosur',
    )
    await expect(
      actingAs(STAFF.technician).network.saveCentre({
        ...masters.centres[0]!,
        id: undefined,
      }),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await expect(
      manager.network.saveCentre({
        ...masters.centres[0]!,
        id: undefined,
        name: 'Copy',
      }),
    ).rejects.toMatchObject({ code: 'duplicate-code' })
    const messaging = await labApi.network.messaging()
    // Every active SMS template carries its DLT registration.
    expect(
      messaging.templates
        .filter((t) => t.channel === 'sms' && t.active)
        .every((t) => t.dltTemplateId),
    ).toBe(true)
  })

  it('books, assigns and completes a home visit, with proof', async () => {
    const patient = Object.values(getDb().patients).find((p) => !p.mergedInto)!
    const slotStart = Date.now() + 3 * HOUR
    await expect(
      desk.network.bookHomeVisit({
        patientId: patient.id,
        address: '7, Lake Road',
        pinCode: '56001',
        slotStart,
      }),
    ).rejects.toMatchObject({ code: 'invalid-pin' })
    await expect(
      desk.network.bookHomeVisit({
        patientId: patient.id,
        address: '7, Lake Road',
        pinCode: '560001',
        slotStart: Date.now() - 2 * HOUR,
      }),
    ).rejects.toMatchObject({ code: 'slot-invalid' })
    const id = await desk.network.bookHomeVisit({
      patientId: patient.id,
      address: '7, Lake Road',
      pinCode: '560001',
      slotStart,
    })
    // Only the assigned phlebotomist moves it along.
    await expect(
      phlebotomist.network.updateHomeVisit(id, { state: 'en-route' }),
    ).rejects.toMatchObject({ code: 'visit-state' })
    await expect(
      desk.network.assignHomeVisit(id, STAFF.phlebotomist),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await manager.network.assignHomeVisit(id, STAFF.phlebotomist)
    await phlebotomist.network.updateHomeVisit(id, { state: 'en-route' })
    await expect(
      phlebotomist.network.updateHomeVisit(id, { state: 'collected' }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
    await phlebotomist.network.updateHomeVisit(id, {
      state: 'collected',
      proof: { coldChain: true, receivedBy: 'Self' },
    })
    const visit = getDb().homeVisits[id]!
    expect(visit.state).toBe('collected')
    expect(visit.proof?.by).toBe(STAFF.phlebotomist)
    await expect(
      desk.network.updateHomeVisit(id, { state: 'cancelled', reason: 'x' }),
    ).rejects.toMatchObject({ code: 'visit-state' })
    expect(
      getDb().audit.some(
        (a) => a.action === 'home-visit-collected' && a.entityId === patient.id,
      ),
    ).toBe(true)
  })

  it("lists today's visits with each phlebotomist's route", async () => {
    const today = await labApi.network.homeVisits()
    expect(today.rows.length).toBeGreaterThan(0)
    expect(today.counts.all).toBe(today.rows.length)
    for (const route of today.routes)
      for (const visitId of route.visits)
        expect(getDb().homeVisits[visitId]?.phlebotomistId).toBe(route.staffId)
    await expect(
      labApi.network.homeVisits({ day: 'yesterday' }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
  })

  it('records a report share in the outbox as not sent, or opted out', async () => {
    const reports = await labApi.reports.list({ date: 'all', q: '' })
    const released = reports.rows.find((r) => r.status === 'released')!
    const patientId = getDb().reports[released.id]!.patientId
    await desk.reports.share(released.id, {
      channel: 'whatsapp',
      recipient: '+91 98450 11223',
    })
    const sent = getDb().outbox[0]!
    expect(sent).toMatchObject({
      event: 'report-ready',
      channel: 'whatsapp',
      state: 'not-sent',
      reason: 'no-gateway',
      relatedId: released.id,
    })
    expect(sent.text).toContain(released.reportNo)

    await desk.network.setOptOut(patientId, 'whatsapp', true)
    await desk.reports.share(released.id, {
      channel: 'whatsapp',
      recipient: '+91 98450 11223',
    })
    expect(getDb().outbox[0]!.reason).toBe('opted-out')
    expect(
      getDb().audit.some(
        (a) => a.action === 'messaging-opted-out' && a.entityId === patientId,
      ),
    ).toBe(true)
  })
})
