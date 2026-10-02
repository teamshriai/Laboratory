// In-memory database persisted to localStorage.
//
// Keeping the demo current: saved data is reloaded and every instant is moved
// forward by the time the app was away, so waiting times and TAT continue
// where they left off and nothing ends up in the future. A fresh seed is also
// saved (seeding is the slowest thing the app does, most of a second on a
// phone), and is regenerated only when a new IST day starts and nobody has
// worked in it. Once someone has, their data is always kept.

import { MINUTE, istDay } from '@/domain/time'
import {
  readStored,
  readStoredRaw,
  removeStored,
  storedKeys,
  writeStored,
  writeStoredRaw,
} from '@/lib/storage'
import { SCHEMA_VERSION, type LabDb } from './schema'
import { seedDatabase } from './seed'
import { createRng } from './seed/random'
import { seedDailyStats } from './seed/stats'

const DB_KEY = `db.v${SCHEMA_VERSION}`
const META_KEY = `db-meta.v${SCHEMA_VERSION}`
const HEARTBEAT_MS = 60_000
const SAVE_DEBOUNCE_MS = 400
const SEED_SAVE_DELAY_MS = 2000

interface Meta {
  seededAt: number
  lastActiveAt: number
  dirty: boolean
}

let db: LabDb | null = null
let meta: Meta | null = null
let rev = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined
let heartbeat: ReturnType<typeof setInterval> | undefined
let persistence = true
/** The data in memory was just generated and has not been saved yet. */
let unsavedSeed = false
/** True when saved work could not be kept (older format or unreadable). */
let refreshed = false
const storageListeners = new Set<(ok: boolean) => void>()

/** Instants are stored as epoch ms in fields named `at` or `...At`. */
const isInstantKey = (key: string) => key === 'at' || key.endsWith('At')

/** Moves every instant forward by `delta` ms, keeping their order intact. */
export function shiftInstants(value: unknown, delta: number) {
  if (Array.isArray(value)) {
    for (const v of value) shiftInstants(v, delta)
  } else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      const v = obj[key]
      if (typeof v === 'number' && isInstantKey(key)) obj[key] = v + delta
      else if (v && typeof v === 'object') shiftInstants(v, delta)
    }
  }
}

function seedFresh(now: number, scale = 1): LabDb {
  const { db: fresh, errors } = seedDatabase(now, { scale })
  if (errors.length && import.meta.env.DEV)
    console.warn('Seed replay errors', errors)
  meta = { seededAt: now, lastActiveAt: now, dirty: false }
  unsavedSeed = persistence
  return fresh
}

/** Removes databases saved by older versions; reports whether any held work. */
function dropOldVersions(): boolean {
  let hadWork = false
  for (const key of storedKeys('db')) {
    if (key === DB_KEY || key === META_KEY) continue
    if (key.startsWith('db-meta.')) {
      const old = readStored<Partial<Meta> | null>(key, null)
      if (old?.dirty) hadWork = true
    }
    removeStored(key)
  }
  return hadWork
}

/** A minimal structural check: the collections every screen reads exist. */
function looksLikeDb(value: unknown): value is LabDb {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.schemaVersion === SCHEMA_VERSION &&
    ['patients', 'orders', 'items', 'samples', 'reports', 'tests'].every(
      (k) => v[k] !== null && typeof v[k] === 'object',
    ) &&
    Array.isArray(v.activity) &&
    Array.isArray(v.audit)
  )
}

function load(now: number): LabDb {
  if (!persistence) return seedFresh(now)
  if (dropOldVersions()) refreshed = true
  const storedMeta = readStored<Meta | null>(META_KEY, null)
  const raw = readStoredRaw(DB_KEY)
  if (!storedMeta || !raw) return seedFresh(now)
  // An untouched demo starts each IST day afresh.
  if (!storedMeta.dirty && istDay(now) !== istDay(storedMeta.seededAt))
    return seedFresh(now)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!looksLikeDb(parsed)) {
      refreshed = true
      return seedFresh(now)
    }
    const away = now - storedMeta.lastActiveAt
    if (away > MINUTE) {
      // seededAt is an instant too, so this moves it as well.
      shiftInstants(parsed, away)
      if (istDay(now) !== istDay(storedMeta.lastActiveAt))
        parsed.dailyStats = seedDailyStats(now, createRng(20260928))
    }
    meta = {
      seededAt: parsed.seededAt,
      lastActiveAt: now,
      dirty: storedMeta.dirty,
    }
    return parsed
  } catch {
    refreshed = true
    return seedFresh(now)
  }
}

function startHeartbeat() {
  if (heartbeat || typeof window === 'undefined' || !persistence) return
  heartbeat = setInterval(() => {
    if (!meta) return
    meta.lastActiveAt = Date.now()
    writeStored(META_KEY, meta)
  }, HEARTBEAT_MS)
  window.addEventListener('pagehide', flush)
}

export function getDb(): LabDb {
  if (!db) {
    db = load(Date.now())
    rev += 1
    startHeartbeat()
    keepSeed()
  }
  return db
}

/** Saves a fresh seed once the first screen has rendered. */
function keepSeed() {
  if (!unsavedSeed) return
  unsavedSeed = false
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(save, SEED_SAVE_DELAY_MS)
}

/**
 * True once if saved demo work had to be replaced by fresh data on this load,
 * so the notice is shown a single time.
 */
export function wasDataRefreshed() {
  getDb()
  const was = refreshed
  refreshed = false
  return was
}

export function getRev() {
  return rev
}

function save() {
  saveTimer = undefined
  if (!db || !meta || !persistence) return
  meta.lastActiveAt = Date.now()
  try {
    writeStoredRaw(DB_KEY, JSON.stringify(db))
    writeStored(META_KEY, meta)
    storageListeners.forEach((l) => l(true))
  } catch {
    // Quota exceeded or storage blocked: keep working in memory.
    storageListeners.forEach((l) => l(false))
  }
}

export function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    save()
  } else if (meta && persistence) {
    meta.lastActiveAt = Date.now()
    writeStored(META_KEY, meta)
  }
}

/** Swaps in the result of a successful write (writes run on a copy). */
export function replaceDb(next: LabDb) {
  db = next
  commit()
}

/** Call after every mutation. */
export function commit() {
  rev += 1
  if (meta) meta.dirty = true
  if (!persistence) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS)
}

/** Throws the demo away and seeds a fresh laboratory relative to now. */
export function resetDb() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = undefined
  removeStored(DB_KEY)
  removeStored(META_KEY)
  db = seedFresh(Date.now())
  rev += 1
  keepSeed()
  return db
}

export function onStorageResult(listener: (ok: boolean) => void) {
  storageListeners.add(listener)
  return () => storageListeners.delete(listener)
}

export function getDbStats() {
  const current = getDb()
  return {
    seededAt: meta?.seededAt ?? current.seededAt,
    dirty: meta?.dirty ?? false,
    bytes: JSON.stringify(current).length,
  }
}

/** Tests: run purely in memory with a fresh seed at a fixed time. */
export function startMemoryDb(now = Date.now(), scale = 1) {
  persistence = false
  db = seedFresh(now, scale)
  rev += 1
  return db
}
