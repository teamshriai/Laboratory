import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_PREFIX } from '@/lib/storage'
import { SCHEMA_VERSION } from './schema'

const DB_KEY = `${STORAGE_PREFIX}db.v${SCHEMA_VERSION}`
const META_KEY = `${STORAGE_PREFIX}db-meta.v${SCHEMA_VERSION}`

/** A fresh copy of the store module, so each case loads from storage. */
async function freshStore() {
  vi.resetModules()
  return import('./store')
}

function saveWork(db: unknown) {
  const now = Date.now()
  localStorage.setItem(DB_KEY, typeof db === 'string' ? db : JSON.stringify(db))
  localStorage.setItem(
    META_KEY,
    JSON.stringify({ seededAt: now, lastActiveAt: now, dirty: true }),
  )
}

describe('persisted store', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('keeps saved work that is readable', async () => {
    const seeded = await freshStore()
    const db = seeded.startMemoryDb()
    const [first] = Object.values(db.patients)
    first!.name = 'Kept Patient'
    saveWork(db)

    const store = await freshStore()
    expect(store.getDb().patients[first!.id]?.name).toBe('Kept Patient')
    expect(store.wasDataRefreshed()).toBe(false)
  })

  it('reseeds unreadable data and says so once', async () => {
    saveWork('{not json')
    const store = await freshStore()
    const db = store.getDb()
    expect(db.schemaVersion).toBe(SCHEMA_VERSION)
    expect(Object.keys(db.patients).length).toBeGreaterThan(0)
    expect(store.wasDataRefreshed()).toBe(true)
    expect(store.wasDataRefreshed()).toBe(false)
  })

  it('reseeds data with the wrong shape', async () => {
    saveWork({ schemaVersion: SCHEMA_VERSION, patients: {}, orders: null })
    const store = await freshStore()
    expect(Array.isArray(store.getDb().audit)).toBe(true)
    expect(store.wasDataRefreshed()).toBe(true)
  })

  it('removes databases saved by an older version', async () => {
    const oldDb = `${STORAGE_PREFIX}db.v${SCHEMA_VERSION - 1}`
    const oldMeta = `${STORAGE_PREFIX}db-meta.v${SCHEMA_VERSION - 1}`
    localStorage.setItem(oldDb, '{}')
    localStorage.setItem(oldMeta, JSON.stringify({ dirty: true }))
    const store = await freshStore()
    store.getDb()
    expect(localStorage.getItem(oldDb)).toBeNull()
    expect(localStorage.getItem(oldMeta)).toBeNull()
    expect(store.wasDataRefreshed()).toBe(true)
  })

  it('saves a fresh seed and reuses it the same day', async () => {
    const first = await freshStore()
    first.getDb()
    first.flush()
    // Tag the saved seed: a regenerated one would not carry the tag.
    const saved = JSON.parse(localStorage.getItem(DB_KEY)!) as {
      patients: Record<string, { name: string }>
    }
    const [id] = Object.keys(saved.patients)
    saved.patients[id!]!.name = 'Saved Seed'
    localStorage.setItem(DB_KEY, JSON.stringify(saved))

    const second = await freshStore()
    expect(second.getDb().patients[id!]?.name).toBe('Saved Seed')
    expect(second.getDbStats().dirty).toBe(false)
    expect(second.wasDataRefreshed()).toBe(false)
  })

  it('regenerates an untouched seed on a new day', async () => {
    const first = await freshStore()
    first.getDb()
    first.flush()
    const meta = JSON.parse(localStorage.getItem(META_KEY)!) as {
      seededAt: number
    }
    meta.seededAt -= 2 * 24 * 60 * 60 * 1000
    localStorage.setItem(META_KEY, JSON.stringify(meta))

    const second = await freshStore()
    expect(second.getDb().seededAt).toBeGreaterThan(meta.seededAt)
    expect(second.wasDataRefreshed()).toBe(false)
  })

  it('moves every instant forward together after time away', async () => {
    const seeded = await freshStore()
    const db = seeded.startMemoryDb()
    db.audit.unshift({
      id: 'au_test',
      at: 1_000,
      by: 'st_anjali',
      entity: 'order',
      entityId: 'o1',
      action: 'cancelled',
    })
    const before = { seededAt: db.seededAt, at: db.audit[0]!.at }
    seeded.shiftInstants(db, 5_000)
    expect(db.seededAt - before.seededAt).toBe(5_000)
    expect(db.audit[0]!.at - before.at).toBe(5_000)
    const sample = Object.values(db.samples).find((s) => s.history.length)!
    const history = sample.history[0]!
    const shifted = structuredClone(sample)
    seeded.shiftInstants(shifted, 1)
    expect(shifted.history[0]!.at).toBe(history.at + 1)
    if (sample.collectedAt)
      expect(shifted.collectedAt).toBe(sample.collectedAt + 1)
  })

  it('starts fresh without a notice when nothing was changed', async () => {
    const store = await freshStore()
    store.getDb()
    expect(store.wasDataRefreshed()).toBe(false)
  })
})
