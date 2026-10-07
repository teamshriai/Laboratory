import { beforeEach, describe, expect, it } from 'vitest'
import { DAY } from '@/domain/time'
import { startMemoryDb } from '../db/store'
import { labApi } from './index'
import { actingAs, STAFF } from './testing'

const manager = actingAs(STAFF.manager)
import { setActor } from './runtime'

describe('laboratory operations', () => {
  beforeEach(() => {
    startMemoryDb()
    setActor('st_prakash')
  })

  it('receives, transfers and disposes reagent stock', async () => {
    const { suppliers, locations } = await labApi.inventory.meta()
    const lotId = await labApi.inventory.receiveLot({
      reagentId: 'rg_glu',
      lotNumber: 'GLU-TEST-01',
      quantity: 10,
      expiresAt: Date.now() + 5 * DAY,
      qcStatus: 'passed',
      supplierId: suppliers[0]!.id,
      locationId: 'loc_cold_room',
    })
    let item = await labApi.inventory.item('reagent', 'rg_glu')
    expect(item.lotRows.some((l) => l.id === lotId)).toBe(true)

    const expiry = await labApi.inventory.expiry()
    expect(expiry.find((r) => r.id === lotId)?.window).toBe('7d')

    const target = locations.find((l) => l.id === 'loc_bio_fridge')!
    await labApi.inventory.transfer({
      kind: 'lot',
      id: lotId,
      toLocationId: target.id,
      quantity: 4,
    })
    item = await labApi.inventory.item('reagent', 'rg_glu')
    const moved = item.lotRows.filter((l) => l.lotNumber === 'GLU-TEST-01')
    expect(moved.map((l) => l.quantity).toSorted()).toEqual([4, 6])
    expect(moved.find((l) => l.quantity === 4)?.locationName).toBe(target.name)

    await labApi.inventory.disposeLot(lotId, 'Damaged in transit.')
    item = await labApi.inventory.item('reagent', 'rg_glu')
    expect(item.lotRows.find((l) => l.id === lotId)?.state).toBe('disposed')
    expect(item.movements.some((m) => m.type === 'dispose')).toBe(true)
  })

  it('runs a QC failure through investigation to a passing repeat', async () => {
    const before = await labApi.qc.get()
    const lot =
      before.controlLots.find((c) => c.analyteId === 'glu_f') ??
      before.controlLots[0]!
    const bad = lot.mean + lot.sd * 3.6
    expect(
      await labApi.qc.record({
        equipmentId: lot.equipmentId,
        analyteId: lot.analyteId,
        level: lot.level,
        value: bad,
      }),
    ).toBe('fail')
    let view = await labApi.qc.get()
    const event = view.events.find(
      (e) =>
        e.status === 'open' &&
        e.equipmentId === lot.equipmentId &&
        e.analyteId === lot.analyteId,
    )!
    expect(event).toBeDefined()
    const equipment = await labApi.equipment.get(lot.equipmentId)
    expect(equipment.openQcEvents).toBeGreaterThan(0)

    await labApi.qc.advanceEvent(
      event.id,
      'Control vial left open; evaporation.',
    )
    await labApi.qc.advanceEvent(event.id, 'Fresh control vial reconstituted.')
    expect(await labApi.qc.advanceEvent(event.id, 'Repeat requested.')).toBe(
      'repeat-pending',
    )
    expect(
      await labApi.qc.record({
        equipmentId: lot.equipmentId,
        analyteId: lot.analyteId,
        level: lot.level,
        value: lot.mean,
      }),
    ).toBe('pass')
    view = await labApi.qc.get()
    expect(view.events.find((e) => e.id === event.id)?.status).toBe('resolved')
  })

  it('schedules and completes maintenance, and records calibration', async () => {
    const id = 'eq_9180'
    await labApi.equipment.scheduleMaintenance(id, {
      kind: 'corrective',
      dueAt: Date.now() + DAY,
      title: 'Replace sodium electrode',
      assignee: 'Roche service',
    })
    let eq = await labApi.equipment.get(id)
    const task = eq.maintenancePlan.find(
      (t) => t.title === 'Replace sodium electrode',
    )!
    expect(task.status).toBe('scheduled')
    await labApi.equipment.completeMaintenance(id, {
      taskId: task.id,
      performedAt: Date.now() - 60_000,
      performedBy: 'Roche service',
      work: 'Sodium electrode replaced.',
      downtimeMin: 90,
      nextDueAt: Date.now() + 30 * DAY,
    })
    eq = await labApi.equipment.get(id)
    expect(eq.status).not.toBe('out-of-service')
    expect(eq.maintenancePlan.find((t) => t.id === task.id)?.status).toBe(
      'done',
    )
    expect(eq.log.find((l) => l.type === 'maintenance')?.downtimeMin).toBe(90)

    await labApi.equipment.recordCalibration(id, {
      performedAt: Date.now() - 1000,
      result: 'pass',
      certificateNo: 'CAL/TEST/0001',
      nextDueAt: Date.now() + 60 * DAY,
    })
    eq = await labApi.equipment.get(id)
    expect(eq.calibrationState).toBe('valid')
    expect(eq.calibrations[0]?.certificateNo).toBe('CAL/TEST/0001')
  })

  it('assigns samples and filters the work queue', async () => {
    const list = await labApi.workQueue.list({ bucket: 'received' })
    const sample = list.rows[0]!
    await manager.samples.assign([sample.id], 'st_deepa')
    const mine = await labApi.workQueue.list({ assignee: 'st_deepa' })
    expect(mine.rows.some((r) => r.id === sample.id)).toBe(true)
    expect(list.counts.all).toBeGreaterThan(list.counts.received)
  })

  it('reports analytics for every range and applies settings', async () => {
    for (const preset of ['today', 'yesterday', '7d', '30d'] as const) {
      const report = await labApi.analytics.report({ preset })
      expect(report.buckets.length).toBeGreaterThan(0)
      expect(report.bucketUnit).toBe(
        preset === 'today' || preset === 'yesterday' ? 'hour' : 'day',
      )
    }
    // A hand-edited custom range is refused, not a RangeError.
    for (const range of [
      { from: 'x' },
      { to: '2026-00-10' },
      { from: '2026-02-30' },
    ])
      await expect(
        labApi.analytics.report({ preset: 'custom', ...range }),
      ).rejects.toMatchObject({
        code: 'validation-failed',
        params: { field: 'range' },
      })
    await manager.system.updateSettings({ samplePrefix: 'SHL' })
    expect((await labApi.system.settings()).samplePrefix).toBe('SHL')
    await expect(
      manager.system.updateSettings({ samplePrefix: 'x1' }),
    ).rejects.toThrow()
  })
})
