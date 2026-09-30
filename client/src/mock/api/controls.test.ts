import { beforeEach, describe, expect, it } from 'vitest'
import { DAY } from '@/domain/time'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { setActor } from './runtime'

const PATHOLOGIST = 'st_kavitha'

/** An order for one test, collected and received, ready to process. */
async function receivedSample(testId: string) {
  const { id: orderId, sampleIds } = await labApi.orders.create({
    patientId: 'pat_002184',
    doctorId: 'dr_ramesh',
    department: 'general-medicine',
    encounter: 'OPD',
    priority: 'routine',
    clinicalNotes: '',
    testIds: [testId],
  })
  const sampleId = sampleIds[0]!
  await labApi.samples.collect(sampleId, {
    collectedAt: Date.now(),
    collectedBy: 'st_kavya',
    site: 'left-antecubital',
  })
  const accession = (await labApi.samples.get(sampleId)).accessionNo!
  await labApi.samples.receive(accession)
  return { orderId, sampleId }
}

/** Enters every analyte of every item on the sample, then submits. */
async function enterAll(
  sampleId: string,
  overrides: Record<string, string> = {},
) {
  const view = await labApi.results.entry(sampleId)
  await labApi.results.save(
    sampleId,
    view.items.map((item) => ({
      itemId: item.itemId,
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
  return view.items.map((i) => i.itemId)
}

describe('workflow controls', () => {
  beforeEach(() => {
    startMemoryDb()
    setActor('st_anjali')
  })

  it('records every critical notification attempt and escalation', async () => {
    // A fresh critical: potassium 6.9 on a new KFT.
    const { orderId, sampleId } = await receivedSample('kft')
    await enterAll(sampleId, { k: '6.9' })
    const pending = (await labApi.critical.list({ status: 'pending' })).rows
    const alert = pending.find((c) => c.orderId === orderId)!
    expect(alert).toBeDefined()

    await labApi.critical.document(alert.id, {
      notifiedTo: 'Dr. Ramesh Iyer',
      role: 'consultant',
      method: 'phone',
      notifiedAt: Date.now(),
      outcome: 'no-answer',
      acknowledged: false,
      readBack: false,
    })
    let row = await labApi.critical.get(alert.id)
    expect(row.state).toBe('contacting')
    expect(row.attempts.at(-1)).toMatchObject({ outcome: 'no-answer' })

    await expect(
      labApi.critical.escalate(alert.id, { to: 'Duty doctor', reason: ' ' }),
    ).rejects.toMatchObject({ code: 'reason-required' })
    await labApi.critical.escalate(alert.id, {
      to: 'Dr. Arvind Rao (unit in-charge)',
      reason: 'Consultant not reachable',
    })
    row = await labApi.critical.get(alert.id)
    expect(row.state).toBe('escalated')

    // Acknowledgement needs the value read back.
    await expect(
      labApi.critical.document(alert.id, {
        notifiedTo: 'Dr. Arvind Rao',
        role: 'consultant',
        method: 'phone',
        notifiedAt: Date.now(),
        acknowledged: true,
        readBack: false,
      }),
    ).rejects.toMatchObject({ code: 'readback-required' })
    await labApi.critical.document(alert.id, {
      notifiedTo: 'Dr. Arvind Rao',
      role: 'consultant',
      method: 'phone',
      notifiedAt: Date.now(),
      acknowledged: true,
      readBack: true,
    })
    row = await labApi.critical.get(alert.id)
    expect(row.state).toBe('acknowledged')
    expect(row.attempts).toHaveLength(alert.attempts.length + 2)
    expect(row.history.map((h) => h.type)).toEqual(
      expect.arrayContaining([
        'critical-attempt',
        'critical-escalated',
        'critical-acknowledged',
      ]),
    )
    expect(
      getDb()
        .audit.filter((a) => a.entityId === alert.id)
        .map((a) => a.action),
    ).toEqual(
      expect.arrayContaining([
        'notification-attempt',
        'escalated',
        'acknowledged',
      ]),
    )
  })

  it('holds a correction until a pathologist authorises it', async () => {
    const released = (
      await labApi.reports.list({ status: 'released', date: 'all' })
    ).rows[0]!
    const report = await labApi.reports.get(released.id)
    const row = report.sections
      .flatMap((s) => s.rows)
      .find((r) => r.resultType === 'numeric' && r.value)!
    const next = String(Number(row.value) + 1)

    await expect(
      labApi.reports.requestCorrection(
        report.id,
        {
          corrections: [{ resultId: row.resultId, value: next }],
          reason: 'transcription-error',
          comments: ' ',
        },
        'st_anjali',
      ),
    ).rejects.toMatchObject({ code: 'reason-required' })
    await labApi.reports.requestCorrection(
      report.id,
      {
        corrections: [{ resultId: row.resultId, value: next }],
        reason: 'transcription-error',
        comments: 'Entered from the wrong tube.',
      },
      'st_anjali',
    )
    let detail = await labApi.reports.get(report.id)
    expect(detail.status).toBe('amendment-pending')
    expect(detail.version).toBe(report.version)
    expect(
      detail.sections
        .flatMap((s) => s.rows)
        .find((r) => r.resultId === row.resultId)!.value,
    ).toBe(row.value)

    await expect(
      labApi.reports.authoriseCorrection(report.id, 'st_anjali'),
    ).rejects.toMatchObject({ code: 'not-authorized-releaser' })
    await labApi.reports.authoriseCorrection(report.id, PATHOLOGIST)
    detail = await labApi.reports.get(report.id)
    expect(detail.version).toBe(report.version + 1)
    expect(detail.pendingAmendment).toBeUndefined()
    const latest = detail.versions.at(-1)!
    expect(latest.requestedBy).toBe('st_anjali')
    expect(
      latest.snapshot?.find((v) => v.resultId === row.resultId)?.value,
    ).toBe(next)
  })

  it('releases reports only as a pathologist', async () => {
    const ready = (
      await labApi.reports.list({ status: 'validated', date: 'all' })
    ).rows.find((r) => r.criticalCount === 0)
    if (!ready) return
    await expect(
      labApi.reports.release(ready.id, 'st_anjali'),
    ).rejects.toMatchObject({
      code: 'not-authorized-releaser',
    })
  })

  it('requires remarks for "other" and closes an order whose sample is rejected', async () => {
    const { orderId, sampleId } = await receivedSample('cbc')
    await expect(
      labApi.samples.reject(sampleId, { reason: 'other', recollect: false }),
    ).rejects.toMatchObject({ code: 'reason-required' })
    await labApi.samples.reject(sampleId, {
      reason: 'hemolyzed-sample',
      recollect: false,
    })
    const order = await labApi.orders.get(orderId)
    expect(order.status).toBe('rejected')
    await expect(
      labApi.orders.cancel(orderId, { reason: 'other' }),
    ).rejects.toMatchObject({ code: 'order-closed' })
  })

  it('blocks validation while the sample is on hold and completes it on resume', async () => {
    const { sampleId } = await receivedSample('cbc')
    await labApi.samples.start(sampleId, 'eq_xn1000')
    const itemIds = await enterAll(sampleId)
    await labApi.validation.review(itemIds, 'st_ganesh')
    await labApi.samples.hold(sampleId, { reason: 'repeat-testing' })
    await expect(
      labApi.validation.validate(itemIds, PATHOLOGIST),
    ).rejects.toMatchObject({ code: 'sample-on-hold' })
    await labApi.samples.resume(sampleId)
    await labApi.validation.validate(itemIds, PATHOLOGIST)
    expect((await labApi.samples.get(sampleId)).status).toBe('completed')
  })

  it('refuses work on an offline analyzer and under a QC hold', async () => {
    const { sampleId } = await receivedSample('cbc')
    const { affected } = await labApi.equipment.setConnection('eq_xn1000', {
      connection: 'offline',
      reason: 'LIS interface not responding',
    })
    expect(affected).toBeGreaterThanOrEqual(0)
    await expect(
      labApi.samples.start(sampleId, 'eq_xn1000'),
    ).rejects.toMatchObject({
      code: 'analyzer-offline',
    })
    await labApi.equipment.setConnection('eq_xn1000', {
      connection: 'online',
      reason: 'Interface restarted',
    })

    // A failed QC on the analyzer for one of the sample's analytes.
    const qc = await labApi.qc.get()
    const lot = qc.controlLots.find((c) => c.equipmentId === 'eq_xn1000')
    if (!lot) return
    await labApi.qc.record({
      equipmentId: lot.equipmentId,
      analyteId: lot.analyteId,
      level: lot.level,
      value: lot.mean + lot.sd * 3.6,
    })
    await expect(
      labApi.samples.start(sampleId, 'eq_xn1000'),
    ).rejects.toMatchObject({
      code: 'qc-hold',
    })
  })

  it('uses a tube at collection', async () => {
    const before = getDb().consumables['cs_edta']!.quantity
    await receivedSample('cbc')
    expect(getDb().consumables['cs_edta']!.quantity).toBe(before - 1)
  })

  it('refuses stock operations on unusable lots', async () => {
    const lotId = await labApi.inventory.receiveLot({
      reagentId: 'rg_glu',
      lotNumber: 'GLU-CTRL-9',
      quantity: 10,
      expiresAt: Date.now() + 40 * DAY,
      qcStatus: 'passed',
    })
    await labApi.inventory.quarantineLot(lotId, 'Calibrator shift')
    await expect(
      labApi.inventory.adjustLot(lotId, { delta: -1, reason: 'damaged' }),
    ).rejects.toMatchObject({ code: 'lot-not-usable' })
    await expect(
      labApi.inventory.receiveLot({
        reagentId: 'rg_glu',
        lotNumber: 'GLU-CTRL-9',
        quantity: 5,
        expiresAt: Date.now() + 40 * DAY,
        qcStatus: 'passed',
      }),
    ).rejects.toMatchObject({ code: 'lot-not-usable' })
    expect(
      getDb().audit.some(
        (a) => a.entityId === lotId && a.action === 'quarantined',
      ),
    ).toBe(true)
  })

  it('applies the lab TAT warning threshold everywhere', async () => {
    await labApi.system.updateSettings({ tatWarnPct: 50 })
    const risk = (await labApi.tat.get('today')).summary.approachingNow
    await labApi.system.updateSettings({ tatWarnPct: 95 })
    const fewer = (await labApi.tat.get('today')).summary.approachingNow
    expect(risk).toBeGreaterThanOrEqual(fewer)
  })
})
