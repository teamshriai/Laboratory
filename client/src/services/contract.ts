// The contract between the screens and whatever serves the laboratory's
// data. The in-browser mock defines it today; the HTTP adapter
// (services/http) must satisfy exactly the same shape, so screens never
// change when the backend arrives.

import type { labApi as mockLabApi } from '@/mock/api'

type MockApi = typeof mockLabApi

/**
 * Everything a backend serves. Resetting the demo database and measuring
 * browser storage only exist in the demo, so they are not part of it.
 */
export type LabApi = Omit<MockApi, 'system'> & {
  system: Omit<MockApi['system'], 'reset' | 'stats'>
}

export interface DemoSettings {
  /** Adds realistic latency so loading states show while developing. */
  latency: boolean
  /** Fails a quarter of requests, to exercise error states. */
  failures: boolean
}

export interface DbStats {
  seededAt: number
  dirty: boolean
  bytes: number
}

/**
 * Controls that exist only while the data lives in this browser: "acting
 * as" (there is no login), simulated latency and failures, storage, reset.
 * With a real backend `enabled` is false and the screens hide them.
 */
export interface DemoControls {
  readonly enabled: boolean
  getActor(): string
  setActor(staffId: string): void
  getSettings(): DemoSettings
  setSettings(next: DemoSettings): void
  reset(): Promise<void>
  stats(): Promise<DbStats>
  /** Saved demo data was replaced (older format or unreadable). */
  wasDataRefreshed(): boolean
  /** Reports whether each save to browser storage worked. */
  onStorageResult(listener: (ok: boolean) => void): () => void
}
