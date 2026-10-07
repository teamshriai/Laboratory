// Stress check (opt-in, `npm run test:perf`; seeding 10x takes a minute or
// more, so it is not part of `test:run`): ten times the demo workload (about 10 times the patients,
// orders, specimens and results of one busy day plus two weeks of history).
// Every screen's read must stay well inside a frame budget a user would
// notice, and a write (which copies the database) must stay usable.

import { beforeAll, describe, expect, it } from 'vitest'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { actingAs, STAFF } from './testing'

const READ_BUDGET_MS = 400
const WRITE_BUDGET_MS = 1500

async function timed<T>(fn: () => Promise<T>) {
  // Warm the index cache once, then measure the median of three runs.
  await fn()
  const runs: number[] = []
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    await fn()
    runs.push(performance.now() - start)
  }
  return runs.toSorted((a, b) => a - b)[1]!
}

describe.skipIf(!import.meta.env.PERF)(
  'performance at 10x the demo data',
  () => {
    let seedMs = 0
    beforeAll(() => {
      const start = performance.now()
      startMemoryDb(Date.now(), 10)
      seedMs = performance.now() - start
    }, 120_000)

    it('builds a database ten times the demo', () => {
      const db = getDb()
      const counts = {
        patients: Object.keys(db.patients).length,
        orders: Object.keys(db.orders).length,
        samples: Object.keys(db.samples).length,
        results: Object.keys(db.results).length,
        audit: db.audit.length,
        bytes: JSON.stringify(db).length,
      }
      console.info('10x database', counts, `seeded in ${Math.round(seedMs)} ms`)
      expect(counts.orders).toBeGreaterThan(800)
    })

    it.each([
      ['dashboard', () => labApi.dashboard.get()],
      ['work queue', () => labApi.workQueue.list({ bucket: 'all', q: '' })],
      [
        'work queue search',
        () => labApi.workQueue.list({ bucket: 'all', q: 'ra' }),
      ],
      ['verification', () => labApi.validation.queue({ stage: 'review' })],
      ['reports', () => labApi.reports.list({ date: 'all', q: '' })],
      ['orders', () => labApi.orders.list({ q: '' })],
      ['global search', () => labApi.search.query('ra')],
      [
        'critical results',
        () => labApi.critical.list({ status: 'all', q: '' }),
      ],
      ['TAT', () => labApi.tat.get('7d')],
      ['audit log', () => labApi.admin.audit({ date: 'all', q: '' })],
      [
        'orders, one sorted page',
        () =>
          labApi.orders.list({
            q: '',
            pageSize: 25,
            page: 3,
            sort: '-patient',
          }),
      ],
      [
        'patients, one sorted page',
        () => labApi.patients.list({ pageSize: 25, sort: 'patient' }),
      ],
      [
        'audit log, one page',
        () => labApi.admin.audit({ date: 'all', q: '', pageSize: 50 }),
      ],
    ] as const)('%s reads within budget', async (name, fn) => {
      const ms = await timed(fn as () => Promise<unknown>)
      console.info(`${name}: ${ms.toFixed(1)} ms`)
      expect(ms).toBeLessThan(READ_BUDGET_MS)
    })

    it('a write (receive a specimen) stays within budget', async () => {
      const tech = actingAs(STAFF.technician)
      const sample = Object.values(getDb().samples).find(
        (s) => s.status === 'collected' && s.accessionNo,
      )!
      const start = performance.now()
      await tech.samples.receive(sample.accessionNo!)
      const ms = performance.now() - start
      console.info(`receive: ${ms.toFixed(1)} ms`)
      expect(ms).toBeLessThan(WRITE_BUDGET_MS)
    })
  },
)
