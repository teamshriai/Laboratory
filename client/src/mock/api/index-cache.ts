// Read-side index over the database, built once per database version. Writes
// replace the database object, so a WeakMap keyed on it is always current.

import type {
  CriticalAlert,
  Flag,
  LabOrder,
  OrderItem,
  ReagentLot,
  ReferenceRange,
  Report,
  Result,
  Sample,
} from '@/domain/types'
import type { LabDb } from '../db/schema'

export interface HistoricResult {
  value: string
  flag: Flag | null
  at: number
  orderId: string
  itemId: string
}

export interface DbIndex {
  itemsByOrder: Map<string, OrderItem[]>
  itemsBySample: Map<string, OrderItem[]>
  itemsByReport: Map<string, OrderItem[]>
  samplesByOrder: Map<string, Sample[]>
  samplesById: Map<string, Sample>
  /** Aliquots by the specimen they were split from. */
  aliquotsByParent: Map<string, Sample[]>
  /** Specimens still to collect, by patient. */
  pendingByPatient: Map<string, Sample[]>
  resultsByItem: Map<string, Result[]>
  reportsByOrder: Map<string, Report[]>
  ordersByPatient: Map<string, LabOrder[]>
  criticalsByItem: Map<string, CriticalAlert[]>
  rangesByAnalyte: Map<string, ReferenceRange[]>
  lotsByReagent: Map<string, ReagentLot[]>
  /** Validated results per `${patientId}:${analyteId}`, newest first. */
  history: Map<string, HistoricResult[]>
}

const cache = new WeakMap<LabDb, DbIndex>()

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function getIndex(db: LabDb): DbIndex {
  const cached = cache.get(db)
  if (cached) return cached
  const index: DbIndex = {
    itemsByOrder: new Map(),
    itemsBySample: new Map(),
    itemsByReport: new Map(),
    samplesByOrder: new Map(),
    samplesById: new Map(Object.entries(db.samples)),
    aliquotsByParent: new Map(),
    pendingByPatient: new Map(),
    resultsByItem: new Map(),
    reportsByOrder: new Map(),
    ordersByPatient: new Map(),
    criticalsByItem: new Map(),
    rangesByAnalyte: new Map(),
    lotsByReagent: new Map(),
    history: new Map(),
  }
  for (const item of Object.values(db.items)) {
    push(index.itemsByOrder, item.orderId, item)
    if (item.sampleId) push(index.itemsBySample, item.sampleId, item)
    push(index.itemsByReport, item.reportId, item)
  }
  for (const s of Object.values(db.samples)) {
    push(index.samplesByOrder, s.orderId, s)
    if (s.parentId) push(index.aliquotsByParent, s.parentId, s)
    if (s.status === 'pending_collection')
      push(index.pendingByPatient, s.patientId, s)
  }
  for (const r of Object.values(db.results))
    push(index.resultsByItem, r.orderItemId, r)
  for (const r of Object.values(db.reports))
    push(index.reportsByOrder, r.orderId, r)
  for (const o of Object.values(db.orders))
    push(index.ordersByPatient, o.patientId, o)
  for (const c of Object.values(db.criticals))
    push(index.criticalsByItem, c.orderItemId, c)
  for (const r of Object.values(db.ranges))
    push(index.rangesByAnalyte, r.analyteId, r)
  for (const l of Object.values(db.lots))
    push(index.lotsByReagent, l.reagentId, l)

  for (const item of Object.values(db.items)) {
    if (item.status !== 'validated' || !item.active) continue
    const order = db.orders[item.orderId]
    if (!order) continue
    for (const r of index.resultsByItem.get(item.id) ?? []) {
      if (r.value === null) continue
      push(index.history, `${order.patientId}:${r.analyteId}`, {
        value: r.value,
        flag: r.flag,
        at: item.validatedAt ?? r.updatedAt,
        orderId: order.id,
        itemId: item.id,
      })
    }
  }
  for (const list of index.history.values()) list.sort((a, b) => b.at - a.at)
  cache.set(db, index)
  return index
}
