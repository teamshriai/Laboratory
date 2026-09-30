import { describe, expect, it } from 'vitest'
import { deriveOrderStatus } from '@/domain/workflow'
import { seedDatabase } from './index'

// 28 Sep 2026, 16:30 IST.
const NOW = Date.UTC(2026, 8, 28, 11, 0)

describe('seedDatabase', () => {
  const { db, errors } = seedDatabase(NOW)

  it('replays every scheduled action without engine errors', () => {
    expect(errors).toEqual([])
  })

  it('stays well inside the localStorage budget', () => {
    const bytes = new Blob([JSON.stringify(db)]).size
    expect(bytes).toBeLessThan(2.5 * 1024 * 1024)
  })

  it('never creates timestamps in the future', () => {
    const future: string[] = []
    const walk = (value: unknown, path: string) => {
      if (Array.isArray(value))
        value.forEach((v, i) => walk(v, `${path}[${i}]`))
      else if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value)) {
          if (
            typeof v === 'number' &&
            k.endsWith('At') &&
            ![
              'expiresAt',
              'nextMaintenanceAt',
              'calibrationDueAt',
              'dueAt',
              'nextDueAt',
            ].includes(k) &&
            v > NOW + 60_000
          )
            future.push(`${path}.${k}`)
          else walk(v, `${path}.${k}`)
        }
    }
    walk(db, 'db')
    expect(future.slice(0, 5)).toEqual([])
  })

  it('contains every scenario from the manifest', () => {
    const samples = Object.values(db.samples)
    const items = Object.values(db.items)
    const samplesById = new Map(samples.map((s) => [s.id, s]))
    const criticals = Object.values(db.criticals)
    const reports = Object.values(db.reports)

    expect(criticals.some((c) => c.status === 'open')).toBe(true)
    expect(criticals.some((c) => c.status === 'notified')).toBe(true)
    expect(criticals.some((c) => c.status === 'acknowledged')).toBe(true)
    expect(
      samples.filter(
        (s) => s.status === 'rejected' && s.rejection?.recollectionRequested,
      ),
    ).toHaveLength(4)
    expect(samples.some((s) => s.status === 'on_hold')).toBe(true)
    expect(items.some((i) => i.status === 'returned')).toBe(true)
    expect(reports.some((r) => r.versions.length > 1)).toBe(true)
    expect(Object.values(db.orders).some((o) => o.state === 'draft')).toBe(true)

    const statuses = new Set(
      Object.values(db.orders).map((o) =>
        deriveOrderStatus(
          o,
          items.filter((i) => i.orderId === o.id),
          samplesById,
        ),
      ),
    )
    for (const s of [
      'draft',
      'new',
      'processing',
      'pending-result',
      'awaiting-review',
      'awaiting-validation',
      'completed',
    ])
      expect(statuses).toContain(s)
  })
})
