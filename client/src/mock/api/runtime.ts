// Behaves like a network boundary: async, a little latency, optional simulated
// failures, and deep copies in both directions so screens never share objects
// with the database.

import { setTatWarnRatio } from '@/domain/tat'
import { readStored, writeStored } from '@/lib/storage'
import type { LabDb } from '../db/schema'
import { getDb, replaceDb } from '../db/store'
import { DEFAULT_ACTOR_ID } from '../db/seed/people'
import { LabApiError, type EngineCtx } from '../engine/core'
import { getIndex, type DbIndex } from './index-cache'

export interface DemoSettings {
  latency: boolean
  failures: boolean
}

const SETTINGS_KEY = 'demo-settings'
const isTest = import.meta.env.MODE === 'test'

// Simulated latency exercises loading states while developing; production
// builds answer at once (it can still be switched on in Settings).
let settings: DemoSettings = readStored<DemoSettings>(SETTINGS_KEY, {
  latency: !import.meta.env.PROD,
  failures: false,
})
let actorId: string = readStored<string>('acting-as', DEFAULT_ACTOR_ID)

export function getDemoSettings() {
  return settings
}

export function setDemoSettings(next: DemoSettings) {
  settings = next
  writeStored(SETTINGS_KEY, next)
}

/** The staff member the app is acting as (there is no login). */
export function getActor() {
  return actorId
}

export function setActor(id: string) {
  actorId = id
}

function delay(ms: number) {
  if (isTest || !settings.latency) return Promise.resolve()
  return new Promise<void>((resolve) =>
    setTimeout(resolve, ms * (0.7 + Math.random() * 0.6)),
  )
}

function maybeFail() {
  if (!isTest && settings.failures && Math.random() < 0.25)
    throw new LabApiError('simulated-failure')
}

export interface ReadCtx {
  now: number
  index: DbIndex
  actor: string
}

export async function read<T>(
  fn: (db: LabDb, ctx: ReadCtx) => T,
  kind: 'read' | 'search' = 'read',
): Promise<T> {
  await delay(kind === 'search' ? 50 : 150)
  maybeFail()
  const db = getDb()
  setTatWarnRatio(db.settings.tatWarnPct / 100)
  return structuredClone(
    fn(db, { now: Date.now(), index: getIndex(db), actor: actorId }),
  )
}

/**
 * Runs a mutation transactionally: it works on a copy of the database and the
 * copy replaces the original only if the whole mutation succeeds.
 */
export async function write<T>(
  fn: (db: LabDb, ctx: EngineCtx) => T,
): Promise<T> {
  await delay(250)
  maybeFail()
  const working = structuredClone(getDb())
  setTatWarnRatio(working.settings.tatWarnPct / 100)
  const result = fn(working, { now: Date.now(), by: actorId })
  replaceDb(working)
  return structuredClone(result)
}

export function isLabApiError(error: unknown): error is LabApiError {
  return error instanceof LabApiError
}
