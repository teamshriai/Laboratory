import { isItemLive } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import { itemsOfSample } from './core'

/**
 * An unresolved QC failure on this analyzer for any analyte the sample needs
 * (Westgard QC gating): patient runs wait, and results already measured on
 * it cannot be authorised or released until a repeat QC passes. Returns the
 * analyte's name.
 */
export function qcHoldFor(db: LabDb, sampleId: string, equipmentId: string) {
  const analyteIds = new Set(
    itemsOfSample(db, sampleId)
      .filter(isItemLive)
      .flatMap((i) => i.analyteIds),
  )
  const event = Object.values(db.qcEvents).find(
    (e) =>
      e.equipmentId === equipmentId &&
      e.status !== 'resolved' &&
      analyteIds.has(e.analyteId),
  )
  return event ? (db.analytes[event.analyteId]?.name ?? event.analyteId) : null
}
