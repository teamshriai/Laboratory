import { getDbStats, resetDb } from '../db/store'
import { updateSettings } from '../engine/settings'
import { read, write } from './runtime'
import type { LabSettings, ReferenceData } from './types'
import { doctorRef } from './views'

export const referenceApi = {
  get: () =>
    read((db): ReferenceData => ({
      staff: Object.values(db.staff),
      doctors: Object.keys(db.doctors).map((id) => doctorRef(db, id)),
    })),
}

export const systemApi = {
  settings: () => read((db): LabSettings => db.settings),
  updateSettings: (patch: Partial<LabSettings>) =>
    write((db, ctx) => updateSettings(db, patch, ctx)),
  stats: () => Promise.resolve(getDbStats()),
  reset: () =>
    new Promise<void>((resolve) => {
      resetDb()
      resolve()
    }),
}
