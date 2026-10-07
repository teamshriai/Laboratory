// Data source: the laboratory backend over HTTP. Selected at build time
// with VITE_DATA_SOURCE=http (vite.config.ts aliases '@/services/source'
// here), so a backend build carries no mock code.

import { ApiError } from '@/domain/errors'
import type { DemoControls, LabApi } from '../contract'
import { createHttpLabApi } from '../http/lab-api.http'

export const labApi: LabApi = createHttpLabApi()

const unavailable = () => Promise.reject(new ApiError('not-permitted'))

/** No demo with a real backend: the signed-in user is the session's. */
export const demo: DemoControls = {
  enabled: false,
  getActor: () => '',
  setActor: () => undefined,
  getSettings: () => ({ latency: false, failures: false }),
  setSettings: () => undefined,
  reset: unavailable,
  stats: unavailable,
  wasDataRefreshed: () => false,
  onStorageResult: () => () => undefined,
}
