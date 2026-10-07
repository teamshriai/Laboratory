// The long lists page and sort on the server side, the same way a backend
// must: one page plus the total, clamped, sorted by known keys only.

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { paginate } from './paging'
import { actingAs, STAFF } from './testing'

describe('server-side paging', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('returns one page and the total, and the pages add up', async () => {
    const all = await labApi.orders.list({ date: 'all' })
    const first = await labApi.orders.list({ date: 'all', pageSize: 10 })
    expect(first.rows).toHaveLength(10)
    expect(first.page).toEqual({
      total: all.rows.length,
      page: 0,
      pageSize: 10,
    })
    const pages = Math.ceil(all.rows.length / 10)
    const ids = new Set<string>()
    for (let page = 0; page < pages; page++)
      for (const r of (
        await labApi.orders.list({ date: 'all', pageSize: 10, page })
      ).rows)
        ids.add(r.id)
    expect(ids.size).toBe(all.rows.length)
    // Counts describe the whole list, not the page.
    expect(first.counts).toEqual(all.counts)
  })

  it('clamps a page past the end and an oversized page', async () => {
    const past = await labApi.patients.list({ pageSize: 25, page: 9999 })
    expect(past.rows.length).toBeGreaterThan(0)
    expect(past.page.page).toBe(Math.ceil(past.page.total / 25) - 1)
    const huge = await labApi.reports.list({ date: 'all', pageSize: 100000 })
    expect(huge.page.pageSize).toBe(200)
  })

  it('sorts by a known key in either direction and ignores unknown ones', async () => {
    const asc = await labApi.patients.list({ sort: 'patient', pageSize: 200 })
    const names = asc.rows.map((r) => r.name)
    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b)))
    const desc = await labApi.patients.list({ sort: '-patient', pageSize: 200 })
    expect(desc.rows[0]?.name).toBe(names.at(-1))
    const unknown = await labApi.patients.list({ sort: 'password' })
    const plain = await labApi.patients.list({})
    expect(unknown.rows.map((r) => r.id)).toEqual(plain.rows.map((r) => r.id))
  })

  it('pages the audit log and the work queue too', async () => {
    const audit = await labApi.admin.audit({ pageSize: 5 })
    expect(audit.rows).toHaveLength(5)
    expect(audit.page.total).toBeGreaterThan(5)
    const queue = await labApi.workQueue.list({ bucket: 'all', pageSize: 5 })
    expect(queue.rows.length).toBeLessThanOrEqual(5)
    expect(queue.page.total).toBe(queue.counts.all)
  })

  it('keeps nulls last whatever the direction', () => {
    const rows = [{ v: 2 }, { v: null }, { v: 1 }]
    const by = { v: (r: { v: number | null }) => r.v }
    expect(paginate(rows, { sort: 'v' }, by).rows.map((r) => r.v)).toEqual([
      1,
      2,
      null,
    ])
    expect(paginate(rows, { sort: '-v' }, by).rows.map((r) => r.v)).toEqual([
      2,
      1,
      null,
    ])
  })
})

describe('access to personal health information is audited', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('records a view once per half hour, prints and exports', async () => {
    const id = Object.keys(getDb().patients)[0]!
    const before = getDb().audit.length
    await labApi.admin.recordAccess({ kind: 'viewed', entity: 'patient', id })
    await labApi.admin.recordAccess({ kind: 'viewed', entity: 'patient', id })
    expect(getDb().audit.length).toBe(before + 1)
    expect(getDb().audit[0]).toMatchObject({
      action: 'viewed',
      entity: 'patient',
      entityId: id,
    })

    const reportId = Object.keys(getDb().reports)[0]!
    await labApi.reports.recordPrint(reportId)
    expect(getDb().audit[0]).toMatchObject({
      action: 'printed',
      entity: 'report',
      entityId: reportId,
    })
  })

  it('lets only staff with the export right export, and notes the rows', async () => {
    await expect(
      actingAs(STAFF.technician).admin.recordAccess({
        kind: 'exported',
        entity: 'order',
        id: 'orders',
        count: 12,
      }),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await actingAs(STAFF.manager).admin.recordAccess({
      kind: 'exported',
      entity: 'order',
      id: 'orders',
      count: 12,
    })
    expect(getDb().audit[0]).toMatchObject({
      action: 'exported',
      by: STAFF.manager,
      detail: { rows: 12 },
    })
  })
})
