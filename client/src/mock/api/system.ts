import { getDbStats, resetDb } from '../db/store'
import { audit, requirePermission } from '../engine/core'
import { updateSettings } from '../engine/settings'
import { read, write } from './runtime'
import type { LabSettings, ReferenceData, SessionInfo } from './types'
import { doctorRef } from './views'

export const referenceApi = {
  get: () =>
    read((db): ReferenceData => ({
      staff: Object.values(db.staff),
      doctors: Object.keys(db.doctors).map((id) => doctorRef(db, id)),
      referralLabs: Object.values(db.referralLabs),
    })),
}

/**
 * Who is signed in. The demo has no login: it is whoever the app is
 * "acting as". A backend answers from its session (401 when there is none).
 */
export const sessionApi = {
  get: () =>
    read((db, { actor }): SessionInfo => {
      const staff = db.staff[actor]
      return {
        staffId: actor,
        name: staff?.name ?? '',
        role: staff?.role ?? 'technician',
      }
    }),
}

export const systemApi = {
  settings: () => read((db): LabSettings => db.settings),
  updateSettings: (patch: Partial<LabSettings>) =>
    write((db, ctx) => updateSettings(db, patch, ctx)),
  stats: () => Promise.resolve(getDbStats()),
  /**
   * Replaces every record in this browser with a fresh demo day. Only the
   * lab manager may do it, and the fresh data starts with an audit entry
   * saying who reset it.
   */
  reset: async () => {
    await write((db, ctx) => void requirePermission(db, ctx, 'data.reset'))
    resetDb()
    await write((db, ctx) => audit(db, ctx, 'system', 'demo-data', 'reset'))
  },
}
