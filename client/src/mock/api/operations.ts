// Catalog, inventory, equipment and quality control.

import { coefficientOfVariation } from '@/domain/qc'
import {
  consumableStatus,
  daysOfStock,
  equipmentStatus,
  lotStatus,
  usableQuantity,
} from '@/domain/stock'
import { DAY, istDay, startOfIstDay } from '@/domain/time'
import type {
  AdjustReason,
  EquipmentStatus,
  QcLevel,
  StockStatus,
  StockTransaction,
} from '@/domain/types'
import { STOCK_STATUSES } from '@/domain/types'
import { isItemLive } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import { LabApiError, must } from '../engine/core'
import {
  createAnalyte,
  createTest,
  saveRanges,
  setTestActive,
  updateTest,
  type NewAnalyteInput,
  type RangesInput,
  type TestInput,
} from '../engine/catalog'
import {
  completeMaintenance,
  logEquipment,
  recordCalibration,
  setConnection,
  scheduleMaintenance,
  type CalibrationInput,
  type CompleteMaintenanceInput,
  type EquipmentLogInput,
} from '../engine/equipment'
import {
  adjustConsumable,
  adjustLot,
  disposeLot,
  openLot,
  transferStock,
  markLotExpired,
  quarantineLot,
  receiveConsumable,
  receiveLot,
  releaseLot,
  type ReceiveLotInput,
} from '../engine/inventory'
import { advanceQcEvent, recordQcRun, type QcRunInput } from '../engine/qc'
import type { DbIndex } from './index-cache'
import { read, write } from './runtime'
import type {
  CalibrationState,
  CatalogFilters,
  CatalogTest,
  ConsumableRow,
  ControlLotRow,
  EquipmentDetail,
  EquipmentRow,
  ExpiryRow,
  ExpiryWindow,
  InventoryItemDetail,
  InventoryItemFilters,
  InventoryItemRow,
  InventoryKind,
  InventoryMeta,
  InventoryOverview,
  MovementRow,
  QcEventRow,
  LotRow,
  OrderableTest,
  QcFilters,
  QcRow,
  QcView,
  ReagentSummary,
} from './types'
import { matchesQuery, staffName } from './views'

export type {
  NewAnalyteInput,
  CalibrationInput,
  CompleteMaintenanceInput,
  EquipmentLogInput,
  QcRunInput,
  RangesInput,
  ReceiveLotInput,
  TestInput,
}

// ---------- Catalog ----------

export function orderableTests(db: LabDb): OrderableTest[] {
  return Object.values(db.tests)
    .filter((t) => t.active)
    .map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      shortName: t.shortName,
      department: t.department,
      specimen: t.specimen,
      container: t.container,
      volumeMl: t.volumeMl,
      fasting: t.fasting,
      instructions: t.instructions,
      tatHours: t.tatHours,
      statTatHours: t.statTatHours,
      price: t.price,
      analyteNames: t.analyteIds.map((id) => db.analytes[id]?.name ?? id),
      keywords: t.keywords ?? [],
    }))
}

function catalogTest(
  db: LabDb,
  index: DbIndex,
  testId: string,
  now: number,
): CatalogTest {
  const t = must(db.tests, testId, 'test')
  const since = now - 30 * DAY
  return {
    ...t,
    analytes: t.analyteIds.map((id) => ({
      ...db.analytes[id]!,
      ranges: index.rangesByAnalyte.get(id) ?? [],
    })),
    ordersLast30Days: Object.values(db.items).filter(
      (i) =>
        i.testId === testId && (db.orders[i.orderId]?.orderedAt ?? 0) >= since,
    ).length,
  }
}

export const catalogApi = {
  list: (filters: CatalogFilters = {}) =>
    read((db, { index, now }) =>
      Object.values(db.tests)
        .filter((t) => {
          const status = filters.status ?? 'all'
          if (status === 'active' && !t.active) return false
          if (status === 'inactive' && t.active) return false
          if (filters.department && t.department !== filters.department)
            return false
          if (filters.specimen && t.specimen !== filters.specimen) return false
          return matchesQuery(filters.q, [
            t.name,
            t.shortName,
            t.code,
            ...(t.keywords ?? []),
            ...t.analyteIds.map((id) => db.analytes[id]?.name),
          ])
        })
        .map((t) => catalogTest(db, index, t.id, now))
        .toSorted((a, b) => a.code.localeCompare(b.code)),
    ),
  get: (id: string) =>
    read((db, { index, now }) => catalogTest(db, index, id, now)),
  orderable: () => read((db) => orderableTests(db)),
  analytes: () =>
    read((db) =>
      Object.values(db.analytes).toSorted((a, b) =>
        a.name.localeCompare(b.name),
      ),
    ),
  create: (input: TestInput, newAnalyte?: NewAnalyteInput) =>
    write((db, ctx) => {
      const extra = newAnalyte ? createAnalyte(db, newAnalyte, ctx).id : null
      return createTest(
        db,
        {
          ...input,
          analyteIds: [...(input.analyteIds ?? []), ...(extra ? [extra] : [])],
        },
        ctx,
      ).id
    }),
  /** Catalog changes need a reason; they are audited and versioned. */
  update: (
    id: string,
    patch: Partial<TestInput>,
    reason: string,
    newAnalyte?: NewAnalyteInput,
  ) =>
    write((db, ctx) => {
      const extra = newAnalyte
        ? createAnalyte(db, newAnalyte, ctx, reason).id
        : null
      void updateTest(
        db,
        id,
        extra
          ? {
              ...patch,
              analyteIds: [
                ...(patch.analyteIds ?? db.tests[id]?.analyteIds ?? []),
                extra,
              ],
            }
          : patch,
        ctx,
        reason,
      )
    }),
  setActive: (id: string, active: boolean, reason: string) =>
    write((db, ctx) => void setTestActive(db, id, active, ctx, reason)),
  saveRanges: (analyteId: string, input: RangesInput, reason: string) =>
    write((db, ctx) => void saveRanges(db, analyteId, input, ctx, reason)),
}

// ---------- Inventory ----------

function lotRows(db: LabDb, index: DbIndex, now: number): LotRow[] {
  const rows: LotRow[] = []
  for (const reagent of Object.values(db.reagents)) {
    const lots = index.lotsByReagent.get(reagent.id) ?? []
    const total = usableQuantity(lots, now)
    for (const lot of lots) {
      rows.push({
        ...lot,
        reagent,
        status: lotStatus(lot, reagent, total, now),
        daysToExpiry: Math.floor((lot.expiresAt - now) / DAY),
        reagentTotal: total,
        locationName: lot.locationId
          ? (db.locations[lot.locationId]?.name ?? null)
          : null,
        supplierName: lot.supplierId
          ? (db.suppliers[lot.supplierId]?.name ?? null)
          : null,
      })
    }
  }
  return rows
}

/** Stock counts, alerts and consumption; shared by Inventory and the Overview. */
export function inventorySnapshot(
  db: LabDb,
  index: DbIndex,
  now: number,
): InventoryOverview {
  const lots = lotRows(db, index, now)
  const consumables = Object.values(db.consumables).map((c) => ({
    c,
    status: consumableStatus(c, now),
  }))
  const counts = Object.fromEntries(
    STOCK_STATUSES.map((s) => [s, 0]),
  ) as Record<StockStatus, number>
  for (const l of lots)
    if (l.state !== 'depleted' || l.status !== 'out-of-stock')
      counts[l.status] += 1
  for (const { status } of consumables) counts[status] += 1
  const alerts: InventoryOverview['alerts'] = [
    ...lots
      .filter(
        (l) =>
          l.status !== 'in-stock' &&
          !(l.state === 'expired' && l.quantity === 0) &&
          l.state !== 'depleted',
      )
      .map((l) => ({
        kind: 'reagent' as const,
        id: l.id,
        name: l.reagent.name,
        detail: l.lotNumber,
        status: l.status,
        quantity: l.quantity,
        unit: l.reagent.unit,
        expiresAt: l.expiresAt,
        link: `/reagents?lot=${l.id}`,
      })),
    ...consumables
      .filter(({ status }) => status !== 'in-stock')
      .map(({ c, status }) => ({
        kind: 'consumable' as const,
        id: c.id,
        name: c.name,
        detail: c.location,
        status,
        quantity: c.quantity,
        unit: c.unit,
        ...(c.expiresAt ? { expiresAt: c.expiresAt } : {}),
        link: `/consumables?item=${c.id}`,
      })),
  ]
  const categories = [
    ...new Set(Object.values(db.consumables).map((c) => c.category)),
  ]
  return {
    counts,
    alerts: alerts.toSorted(
      (a, b) =>
        STOCK_STATUSES.indexOf(b.status) - STOCK_STATUSES.indexOf(a.status),
    ),
    consumption: categories.map((category) => ({
      category,
      series: db.dailyStats.slice(-14).map((d) => d.consumption[category] ?? 0),
    })),
  }
}

function reagentStatus(
  lots: LabDb['lots'][string][],
  reagent: LabDb['reagents'][string],
  total: number,
  now: number,
): StockStatus {
  const statuses = lots.map((l) => lotStatus(l, reagent, total, now))
  if (total <= 0) return 'out-of-stock'
  if (total <= reagent.reorderLevel) return 'low-stock'
  if (statuses.includes('expiring-soon')) return 'expiring-soon'
  return 'in-stock'
}

function itemRows(db: LabDb, index: DbIndex, now: number): InventoryItemRow[] {
  const reagents = Object.values(db.reagents).map((r): InventoryItemRow => {
    const lots = index.lotsByReagent.get(r.id) ?? []
    const total = usableQuantity(lots, now)
    const live = lots.filter((l) => l.state === 'active' && l.quantity > 0)
    const locations = [
      ...new Set(
        live
          .map((l) => (l.locationId ? db.locations[l.locationId]?.name : null))
          .filter((n): n is string => Boolean(n)),
      ),
    ]
    return {
      kind: 'reagent',
      id: r.id,
      name: r.name,
      category: 'reagent',
      department: r.department,
      sku: r.sku ?? r.id,
      quantity: Math.round(total * 100) / 100,
      unit: r.unit,
      minLevel: r.reorderLevel,
      locations,
      supplierId: r.supplierId ?? null,
      supplierName: r.supplierId
        ? (db.suppliers[r.supplierId]?.name ?? null)
        : null,
      nearestExpiry: live.length
        ? Math.min(...live.map((l) => l.expiresAt))
        : null,
      status: reagentStatus(lots, r, total, now),
      lots: lots.filter((l) => l.state !== 'depleted' && l.state !== 'disposed')
        .length,
      dailyUsage: null,
    }
  })
  const consumables = Object.values(db.consumables).map(
    (c): InventoryItemRow => ({
      kind: 'consumable',
      id: c.id,
      name: c.name,
      category: c.category,
      sku: c.sku ?? c.id,
      quantity: c.quantity,
      unit: c.unit,
      minLevel: c.reorderLevel,
      locations: [c.location],
      supplierId: c.supplierId ?? null,
      supplierName: c.supplierId
        ? (db.suppliers[c.supplierId]?.name ?? null)
        : null,
      nearestExpiry: c.expiresAt ?? null,
      status: consumableStatus(c, now),
      lots: 0,
      dailyUsage: c.dailyUsage,
    }),
  )
  return [...reagents, ...consumables]
}

function expiryWindow(days: number): ExpiryWindow | null {
  if (days < 0) return 'expired'
  if (days <= 7) return '7d'
  if (days <= 30) return '30d'
  if (days <= 90) return '90d'
  return null
}

function inWindow(expiresAt: number | null, window: ExpiryWindow, now: number) {
  if (expiresAt === null) return false
  const w = expiryWindow(Math.floor((expiresAt - now) / DAY))
  if (!w) return false
  const order: ExpiryWindow[] = ['expired', '7d', '30d', '90d']
  return window === 'expired'
    ? w === 'expired'
    : w !== 'expired' && order.indexOf(w) <= order.indexOf(window)
}

function movementRows(db: LabDb): MovementRow[] {
  const loc = (id?: string) => (id ? db.locations[id]?.name : undefined)
  const extra = (t: StockTransaction) => {
    const from = loc(t.fromLocationId)
    const to = loc(t.toLocationId)
    return {
      ...(from ? { fromName: from } : {}),
      ...(to ? { toName: to } : {}),
    }
  }
  const rows: MovementRow[] = []
  for (const lot of Object.values(db.lots)) {
    const r = db.reagents[lot.reagentId]
    if (!r) continue
    for (const t of lot.transactions)
      rows.push({
        ...t,
        ...extra(t),
        kind: 'reagent',
        itemId: r.id,
        itemName: r.name,
        unit: r.unit,
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        byName: staffName(db, t.by),
      })
  }
  for (const c of Object.values(db.consumables))
    for (const t of c.transactions)
      rows.push({
        ...t,
        ...extra(t),
        kind: 'consumable',
        itemId: c.id,
        itemName: c.name,
        unit: c.unit,
        byName: staffName(db, t.by),
      })
  return rows.toSorted((a, b) => b.at - a.at)
}

export const inventoryApi = {
  overview: () =>
    read((db, { index, now }) => inventorySnapshot(db, index, now)),

  lots: (
    filters: {
      q?: string
      status?: StockStatus | 'all'
      department?: string
    } = {},
  ) =>
    read((db, { index, now }) =>
      lotRows(db, index, now)
        .filter((l) =>
          filters.status && filters.status !== 'all'
            ? l.status === filters.status
            : true,
        )
        .filter((l) =>
          filters.department
            ? l.reagent.department === filters.department
            : true,
        )
        .filter((l) =>
          matchesQuery(filters.q, [
            l.reagent.name,
            l.lotNumber,
            l.reagent.manufacturer,
          ]),
        )
        .toSorted((a, b) => a.expiresAt - b.expiresAt),
    ),

  reagents: () =>
    read((db, { index, now }): ReagentSummary[] =>
      Object.values(db.reagents).map((r) => {
        const lots = index.lotsByReagent.get(r.id) ?? []
        const total = usableQuantity(lots, now)
        const statuses = lots.map((l) => lotStatus(l, r, total, now))
        const active = lots.filter(
          (l) => l.state === 'active' && l.expiresAt > now,
        )
        return {
          ...r,
          totalUsable: total,
          status:
            total <= 0
              ? 'out-of-stock'
              : total <= r.reorderLevel
                ? 'low-stock'
                : statuses.includes('expiring-soon')
                  ? 'expiring-soon'
                  : 'in-stock',
          lots: lots.length,
          nearestExpiry: active.length
            ? Math.min(...active.map((l) => l.expiresAt))
            : null,
        }
      }),
    ),

  consumables: (
    filters: {
      q?: string
      status?: StockStatus | 'all'
      category?: string
    } = {},
  ) =>
    read((db, { now }): ConsumableRow[] =>
      Object.values(db.consumables)
        .map((c) => ({
          ...c,
          status: consumableStatus(c, now),
          daysLeft: daysOfStock(c),
        }))
        .filter((c) =>
          filters.status && filters.status !== 'all'
            ? c.status === filters.status
            : true,
        )
        .filter((c) =>
          filters.category ? c.category === filters.category : true,
        )
        .filter((c) => matchesQuery(filters.q, [c.name, c.location])),
    ),

  meta: () =>
    read((db): InventoryMeta => ({
      suppliers: Object.values(db.suppliers).toSorted((a, b) =>
        a.name.localeCompare(b.name),
      ),
      locations: Object.values(db.locations),
    })),

  items: (filters: InventoryItemFilters = {}) =>
    read((db, { index, now }) =>
      itemRows(db, index, now)
        .filter((i) =>
          filters.category ? i.category === filters.category : true,
        )
        .filter((i) => (filters.status ? i.status === filters.status : true))
        .filter((i) =>
          filters.supplierId ? i.supplierId === filters.supplierId : true,
        )
        .filter((i) => {
          if (!filters.locationId) return true
          const name = db.locations[filters.locationId]?.name
          return name ? i.locations.includes(name) : false
        })
        .filter((i) => {
          if (!filters.expiry) return true
          if (i.kind === 'consumable')
            return inWindow(i.nearestExpiry, filters.expiry, now)
          return (index.lotsByReagent.get(i.id) ?? []).some(
            (l) =>
              l.quantity > 0 &&
              l.state !== 'disposed' &&
              inWindow(l.expiresAt, filters.expiry!, now),
          )
        })
        .filter((i) =>
          matchesQuery(filters.q, [
            i.name,
            i.sku,
            i.supplierName,
            ...i.locations,
          ]),
        )
        .toSorted(
          (a, b) =>
            STOCK_STATUSES.indexOf(b.status) -
              STOCK_STATUSES.indexOf(a.status) || a.name.localeCompare(b.name),
        ),
    ),

  item: (kind: InventoryKind, id: string) =>
    read((db, { index, now }): InventoryItemDetail => {
      const row = itemRows(db, index, now).find(
        (i) => i.kind === kind && i.id === id,
      )
      if (!row) throw new LabApiError('not-found', { entity: kind, id })
      const movements = movementRows(db).filter(
        (m) => m.kind === kind && m.itemId === id,
      )
      const current =
        kind === 'reagent'
          ? (index.lotsByReagent.get(id) ?? []).reduce(
              (n, l) => n + l.quantity,
              0,
            )
          : row.quantity
      const net = movements.reduce(
        (n, m) =>
          n + (m.type === 'transfer' && kind === 'consumable' ? 0 : m.quantity),
        0,
      )
      const reagent = kind === 'reagent' ? db.reagents[id] : undefined
      return {
        ...row,
        ...(reagent
          ? { manufacturer: reagent.manufacturer, storage: reagent.storage }
          : {}),
        supplier: row.supplierId
          ? (db.suppliers[row.supplierId] ?? null)
          : null,
        lotRows:
          kind === 'reagent'
            ? lotRows(db, index, now)
                .filter((l) => l.reagentId === id)
                .toSorted((a, b) => a.expiresAt - b.expiresAt)
            : [],
        movements,
        openingBalance: Math.max(0, Math.round((current - net) * 100) / 100),
      }
    }),

  expiry: () =>
    read((db, { now }): ExpiryRow[] => {
      const rows: ExpiryRow[] = []
      for (const lot of Object.values(db.lots)) {
        const r = db.reagents[lot.reagentId]
        if (!r || lot.state === 'disposed' || lot.state === 'depleted') continue
        if (lot.quantity <= 0) continue
        const days = Math.floor((lot.expiresAt - now) / DAY)
        const window = expiryWindow(days)
        if (!window) continue
        rows.push({
          kind: 'reagent',
          id: lot.id,
          itemId: r.id,
          name: r.name,
          lotNumber: lot.lotNumber,
          expiresAt: lot.expiresAt,
          days,
          quantity: lot.quantity,
          unit: r.unit,
          locationName: lot.locationId
            ? (db.locations[lot.locationId]?.name ?? null)
            : null,
          state: lot.state,
          window,
        })
      }
      for (const c of Object.values(db.consumables)) {
        if (!c.expiresAt || c.quantity <= 0) continue
        const days = Math.floor((c.expiresAt - now) / DAY)
        const window = expiryWindow(days)
        if (!window) continue
        rows.push({
          kind: 'consumable',
          id: c.id,
          itemId: c.id,
          name: c.name,
          lotNumber: null,
          expiresAt: c.expiresAt,
          days,
          quantity: c.quantity,
          unit: c.unit,
          locationName: c.location,
          state: null,
          window,
        })
      }
      return rows.toSorted((a, b) => a.expiresAt - b.expiresAt)
    }),

  movements: (limit = 80) => read((db) => movementRows(db).slice(0, limit)),

  transfer: (input: Parameters<typeof transferStock>[1]) =>
    write((db, ctx) => void transferStock(db, input, ctx)),
  disposeLot: (id: string, note: string) =>
    write((db, ctx) => void disposeLot(db, id, note, ctx)),
  openLot: (id: string) => write((db, ctx) => void openLot(db, id, ctx)),

  receiveLot: (input: ReceiveLotInput) =>
    write((db, ctx) => receiveLot(db, input, ctx).id),
  adjustLot: (
    id: string,
    input: { delta: number; reason: AdjustReason; note?: string },
  ) => write((db, ctx) => void adjustLot(db, id, input, ctx)),
  quarantineLot: (id: string, note: string) =>
    write((db, ctx) => void quarantineLot(db, id, note, ctx)),
  releaseLot: (id: string, note: string) =>
    write((db, ctx) => void releaseLot(db, id, note, ctx)),
  markLotExpired: (id: string) =>
    write((db, ctx) => void markLotExpired(db, id, ctx)),
  receiveConsumable: (
    id: string,
    input: { quantity: number; expiresAt?: number; note?: string },
  ) => write((db, ctx) => void receiveConsumable(db, id, input, ctx)),
  adjustConsumable: (
    id: string,
    input: { delta: number; reason: AdjustReason; note?: string },
  ) => write((db, ctx) => void adjustConsumable(db, id, input, ctx)),
}

// ---------- Equipment ----------

export function equipmentRows(
  db: LabDb,
  index: DbIndex,
  now: number,
): EquipmentRow[] {
  const today = startOfIstDay(now)
  const hours = Math.max(1, (now - (today + 7 * 3_600_000)) / 3_600_000)
  return Object.values(db.equipment).map((e) => {
    let testsToday = 0
    for (const s of Object.values(db.samples)) {
      if (s.equipmentId !== e.id || (s.processingStartedAt ?? 0) < today)
        continue
      testsToday += (index.itemsBySample.get(s.id) ?? []).filter(
        isItemLive,
      ).length
    }
    const qc = Object.values(db.qcRuns).filter(
      (r) => r.equipmentId === e.id && r.at >= today,
    )
    const effectiveStatus: EquipmentStatus = equipmentStatus(e, now)
    return {
      ...e,
      effectiveStatus,
      testsToday,
      utilizationPct:
        effectiveStatus === 'out-of-service' ||
        effectiveStatus === 'maintenance'
          ? 0
          : Math.min(
              100,
              Math.round((testsToday / (e.capacityPerHour * hours)) * 1000) /
                10,
            ),
      qcToday:
        qc.length === 0
          ? 'none'
          : qc.some((r) => r.result === 'fail')
            ? 'fail'
            : qc.some((r) => r.result === 'warning')
              ? 'warning'
              : 'pass',
      maintenanceOverdue: e.nextMaintenanceAt < now,
      calibrationOverdue: e.calibrationDueAt < now,
      calibrationState: calibrationState(e, now),
      runningSamples: Object.values(db.samples).filter(
        (s) => s.equipmentId === e.id && s.status === 'processing',
      ).length,
      openQcEvents: Object.values(db.qcEvents).filter(
        (q) => q.equipmentId === e.id && q.status !== 'resolved',
      ).length,
    }
  })
}

export function calibrationState(
  e: LabDb['equipment'][string],
  now: number,
): CalibrationState {
  if (e.calibrations?.[0]?.result === 'fail') return 'failed'
  if (e.calibrationDueAt < now) return 'expired'
  if (e.calibrationDueAt - now <= 7 * DAY) return 'due-soon'
  return 'valid'
}

function qcEventRows(
  db: LabDb,
  filter?: (e: LabDb['qcEvents'][string]) => boolean,
): QcEventRow[] {
  return Object.values(db.qcEvents)
    .filter((e) => (filter ? filter(e) : true))
    .map((e) => {
      const run = db.qcRuns[e.runId]
      return {
        ...e,
        equipmentName: db.equipment[e.equipmentId]?.name ?? e.equipmentId,
        analyteName: db.analytes[e.analyteId]?.name ?? e.analyteId,
        unit: db.analytes[e.analyteId]?.unit ?? '',
        run: run ? (qcRows(db, {}).find((r) => r.id === run.id) ?? null) : null,
        steps: e.steps.map((s) => ({ ...s, byName: staffName(db, s.by) })),
      }
    })
    .toSorted(
      (a, b) =>
        Number(a.status === 'resolved') - Number(b.status === 'resolved') ||
        b.openedAt - a.openedAt,
    )
}

export const equipmentApi = {
  list: (
    filters: {
      q?: string
      status?: EquipmentStatus | 'all'
      department?: string
    } = {},
  ) =>
    read((db, { index, now }) =>
      equipmentRows(db, index, now)
        .filter((e) =>
          filters.status && filters.status !== 'all'
            ? e.effectiveStatus === filters.status
            : true,
        )
        .filter((e) =>
          filters.department ? e.department === filters.department : true,
        )
        .filter((e) =>
          matchesQuery(filters.q, [
            e.name,
            e.model,
            e.manufacturer,
            e.serialNo,
          ]),
        ),
    ),
  get: (id: string) =>
    read((db, { index, now }): EquipmentDetail => {
      const row = equipmentRows(db, index, now).find((e) => e.id === id)
      if (!row) throw new LabApiError('not-found', { entity: 'equipment', id })
      const today = startOfIstDay(now)
      const usage = Array.from({ length: 7 }, (_, i) => {
        const start = today - (6 - i) * DAY
        let tests = 0
        for (const s of Object.values(db.samples)) {
          const at = s.processingStartedAt ?? 0
          if (s.equipmentId !== id || at < start || at >= start + DAY) continue
          tests += (index.itemsBySample.get(s.id) ?? []).filter(
            isItemLive,
          ).length
        }
        return { day: istDay(start), tests }
      })
      return {
        ...row,
        log: row.log
          .map((l) => ({ ...l, byName: staffName(db, l.by) }))
          .toSorted((a, b) => b.at - a.at),
        maintenancePlan: (row.maintenancePlan ?? []).toSorted(
          (a, b) => a.dueAt - b.dueAt,
        ),
        calibrations: (row.calibrations ?? []).map((c) => ({
          ...c,
          byName: staffName(db, c.by),
        })),
        qcRuns: qcRows(db, { equipmentId: id }).slice(0, 40),
        qcEvents: qcEventRows(db, (e) => e.equipmentId === id),
        usage,
        downtimeMin30d:
          row.log
            .filter((l) => l.at >= now - 30 * DAY)
            .reduce((n, l) => n + (l.downtimeMin ?? 0), 0) +
          (row.status === 'out-of-service'
            ? Math.round(
                (now -
                  (row.log
                    .filter((l) => l.type === 'breakdown')
                    .toSorted((a, b) => b.at - a.at)[0]?.at ?? now)) /
                  60_000,
              )
            : 0),
      }
    }),
  log: (id: string, input: EquipmentLogInput) =>
    write((db, ctx) => void logEquipment(db, id, input, ctx)),
  scheduleMaintenance: (
    id: string,
    input: Parameters<typeof scheduleMaintenance>[2],
  ) => write((db, ctx) => void scheduleMaintenance(db, id, input, ctx)),
  completeMaintenance: (id: string, input: CompleteMaintenanceInput) =>
    write((db, ctx) => void completeMaintenance(db, id, input, ctx)),
  recordCalibration: (id: string, input: CalibrationInput) =>
    write((db, ctx) => void recordCalibration(db, id, input, ctx)),
  /** Offline (interface down, error) or back online; returns affected samples. */
  setConnection: (
    id: string,
    input: { connection: 'online' | 'offline'; reason: string },
  ) => write((db, ctx) => setConnection(db, id, input, ctx)),
}

// ---------- Quality control ----------

export function qcRows(db: LabDb, filters: QcFilters): QcRow[] {
  return Object.values(db.qcRuns)
    .filter((r) =>
      filters.equipmentId ? r.equipmentId === filters.equipmentId : true,
    )
    .filter((r) =>
      filters.analyteId ? r.analyteId === filters.analyteId : true,
    )
    .filter((r) =>
      filters.result && filters.result !== 'all'
        ? r.result === filters.result
        : true,
    )
    .map((r) => ({
      ...r,
      equipmentName: db.equipment[r.equipmentId]?.name ?? r.equipmentId,
      analyteName: db.analytes[r.analyteId]?.name ?? r.analyteId,
      unit: db.analytes[r.analyteId]?.unit ?? '',
      z: r.sd > 0 ? (r.value - r.mean) / r.sd : 0,
      byName: staffName(db, r.by),
    }))
    .toSorted((a, b) => b.at - a.at)
}

export const qcApi = {
  get: (filters: QcFilters = {}) =>
    read((db, { now }): QcView => {
      const today = startOfIstDay(now)
      const runs = qcRows(db, filters)
      const todays = runs.filter((r) => r.at >= today)
      const last30 = runs.filter((r) => r.at >= now - 30 * DAY)
      const keys = new Map<
        string,
        { equipmentId: string; analyteId: string; level: QcLevel }
      >()
      for (const r of runs)
        keys.set(`${r.equipmentId}|${r.analyteId}|${r.level}`, {
          equipmentId: r.equipmentId,
          analyteId: r.analyteId,
          level: r.level,
        })
      const controlLots: ControlLotRow[] = Object.values(db.controlLots)
        .filter((c) =>
          filters.equipmentId ? c.equipmentId === filters.equipmentId : true,
        )
        .map((c) => ({
          ...c,
          equipmentName: db.equipment[c.equipmentId]?.name ?? c.equipmentId,
          analyteName: db.analytes[c.analyteId]?.name ?? c.analyteId,
          unit: db.analytes[c.analyteId]?.unit ?? '',
          department: db.equipment[c.equipmentId]?.department ?? 'biochemistry',
        }))
      return {
        events: qcEventRows(db),
        controlLots,
        runs: runs.slice(0, 300),
        summary: {
          runsToday: todays.length,
          passed: todays.filter((r) => r.result === 'pass').length,
          warnings: todays.filter((r) => r.result === 'warning').length,
          failures: todays.filter((r) => r.result === 'fail').length,
          passRate30d: last30.length
            ? (last30.filter((r) => r.result !== 'fail').length /
                last30.length) *
              100
            : null,
        },
        series: [...keys.values()].map((key) => {
          const points = runs
            .filter(
              (r) =>
                r.equipmentId === key.equipmentId &&
                r.analyteId === key.analyteId &&
                r.level === key.level,
            )
            .slice(0, 20)
            .toReversed()
          const last = points.at(-1)!
          const stats = coefficientOfVariation(points.map((p) => p.value))
          return {
            ...key,
            equipmentName: last.equipmentName,
            analyteName: last.analyteName,
            unit: last.unit,
            mean: last.mean,
            sd: last.sd,
            cv: stats ? stats.cv : null,
            last: last.result,
            points: points.map((p) => ({
              at: p.at,
              value: p.value,
              z: p.z,
              result: p.result,
              ...(p.rule ? { rule: p.rule } : {}),
            })),
          }
        }),
      }
    }),
  record: (input: QcRunInput) =>
    write((db, ctx) => recordQcRun(db, input, ctx).result),
  advanceEvent: (id: string, note: string) =>
    write((db, ctx) => advanceQcEvent(db, id, note, ctx).status),
}
