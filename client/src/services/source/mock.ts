// Data source: the in-browser mock backend (the default, and the demo).

import {
  getActor,
  getDemoSettings,
  labApi as mockLabApi,
  onStorageResult,
  setActor,
  setDemoSettings,
  wasDataRefreshed,
} from '@/mock/api'
import type { DemoControls, LabApi } from '../contract'

export const labApi: LabApi = mockLabApi

export const demo: DemoControls = {
  enabled: true,
  getActor,
  setActor,
  getSettings: getDemoSettings,
  setSettings: setDemoSettings,
  reset: () => mockLabApi.system.reset(),
  stats: () => mockLabApi.system.stats(),
  wasDataRefreshed,
  onStorageResult: (listener) => {
    const off = onStorageResult(listener)
    return () => {
      off()
    }
  },
}
