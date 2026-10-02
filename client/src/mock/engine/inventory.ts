import { uid } from '@/domain/ids'
import { isLotUsable } from '@/domain/stock'
import type {
  AdjustReason,
  QcLotStatus,
  ReagentLot,
  StockTransaction,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  logActivity,
  must,
  notify,
  type EngineCtx,
  requirePermission,
} from './core'

function txn(
  ctx: EngineCtx,
  t: Omit<StockTransaction, 'id' | 'at' | 'by'>,
): StockTransaction {
  return { id: uid('txn'), at: ctx.now, by: ctx.by, ...t }
}

export interface ReceiveLotInput {
  reagentId: string
  lotNumber: string
  quantity: number
  expiresAt: number
  qcStatus: QcLotStatus
  note?: string
  supplierId?: string
  locationId?: string
  /** Defaults to now; must not be in the future. */
  receivedAt?: number
}

export function receiveLot(db: LabDb, input: ReceiveLotInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'inventory.manage')
  const reagent = must(db.reagents, input.reagentId, 'reagent')
  const lotNumber = input.lotNumber.trim()
  if (!lotNumber || input.quantity <= 0)
    throw new LabApiError('validation-failed', { field: 'quantity' })
  if (input.expiresAt <= ctx.now)
    throw new LabApiError('validation-failed', { field: 'expiresAt' })
  const existing = Object.values(db.lots).find(
    (l) => l.reagentId === reagent.id && l.lotNumber === lotNumber,
  )
  if (existing) {
    // More stock of a lot already in use: only into a usable lot, and the
    // expiry must match (a different expiry is a different batch).
    if (['disposed', 'expired', 'quarantined'].includes(existing.state))
      throw new LabApiError('lot-not-usable', {
        lot: existing.lotNumber,
        state: existing.state,
      })
    if (Math.abs(existing.expiresAt - input.expiresAt) > 86_400_000)
      throw new LabApiError('validation-failed', { field: 'expiresAt' })
    existing.quantity += input.quantity
    existing.initialQuantity += input.quantity
    if (existing.state === 'depleted') existing.state = 'active'
    existing.transactions.unshift(
      txn(ctx, {
        type: 'receive',
        quantity: input.quantity,
        balance: existing.quantity,
        ...(input.note ? { note: input.note } : {}),
      }),
    )
    audit(db, ctx, 'lot', existing.id, 'received', {
      detail: { item: reagent.name, lot: lotNumber, quantity: input.quantity },
    })
    logActivity(
      db,
      ctx,
      'stock-received',
      { item: reagent.name, lot: lotNumber, quantity: input.quantity },
      '/reagents',
    )
    return existing
  }
  if (input.supplierId) must(db.suppliers, input.supplierId, 'supplier')
  if (input.locationId) must(db.locations, input.locationId, 'location')
  const lot: ReagentLot = {
    id: uid('lot'),
    reagentId: reagent.id,
    lotNumber,
    receivedAt: Math.min(input.receivedAt ?? ctx.now, ctx.now),
    ...((input.supplierId ?? reagent.supplierId)
      ? { supplierId: input.supplierId ?? reagent.supplierId }
      : {}),
    ...(input.locationId ? { locationId: input.locationId } : {}),
    expiresAt: input.expiresAt,
    quantity: input.quantity,
    initialQuantity: input.quantity,
    qcStatus: input.qcStatus,
    state:
      input.qcStatus === 'failed'
        ? ('quarantined' as const)
        : ('active' as const),
    transactions: [
      txn(ctx, {
        type: 'receive',
        quantity: input.quantity,
        balance: input.quantity,
        ...(input.note ? { note: input.note } : {}),
      }),
    ],
  }
  db.lots[lot.id] = lot
  audit(db, ctx, 'lot', lot.id, 'received', {
    detail: { item: reagent.name, lot: lotNumber, quantity: input.quantity },
  })
  logActivity(
    db,
    ctx,
    'stock-received',
    { item: reagent.name, lot: lotNumber, quantity: input.quantity },
    '/reagents',
  )
  return lot
}

export function adjustLot(
  db: LabDb,
  lotId: string,
  input: { delta: number; reason: AdjustReason; note?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'inventory.manage')
  const lot = must(db.lots, lotId, 'lot')
  if (lot.state !== 'active' && lot.state !== 'depleted')
    throw new LabApiError('lot-not-usable', {
      lot: lot.lotNumber,
      state: lot.state,
    })
  if (input.delta === 0)
    throw new LabApiError('validation-failed', { field: 'delta' })
  const next = Math.round((lot.quantity + input.delta) * 1000) / 1000
  if (next < 0)
    throw new LabApiError('insufficient-stock', { available: lot.quantity })
  lot.quantity = next
  if (next === 0 && lot.state === 'active') lot.state = 'depleted'
  if (next > 0 && lot.state === 'depleted') lot.state = 'active'
  lot.transactions.unshift(
    txn(ctx, {
      type: 'adjust',
      quantity: input.delta,
      balance: next,
      reason: input.reason,
      ...(input.note ? { note: input.note } : {}),
    }),
  )
  audit(db, ctx, 'lot', lot.id, 'adjusted', {
    reason: input.note ? `${input.reason}: ${input.note}` : input.reason,
    detail: { lot: lot.lotNumber, change: input.delta, balance: next },
  })
  return lot
}

export function quarantineLot(
  db: LabDb,
  lotId: string,
  note: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'inventory.manage')
  const lot = must(db.lots, lotId, 'lot')
  if (lot.state !== 'active')
    throw new LabApiError('invalid-transition', { from: lot.state })
  lot.state = 'quarantined'
  lot.transactions.unshift(
    txn(ctx, { type: 'quarantine', quantity: 0, balance: lot.quantity, note }),
  )
  audit(db, ctx, 'lot', lot.id, 'quarantined', {
    reason: note,
    detail: { lot: lot.lotNumber },
  })
  const reagent = db.reagents[lot.reagentId]
  notify(
    db,
    ctx,
    'lot-quarantined',
    'warning',
    { item: reagent?.name ?? '', lot: lot.lotNumber },
    '/reagents',
  )
  return lot
}

export function releaseLot(
  db: LabDb,
  lotId: string,
  note: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'inventory.manage')
  const lot = must(db.lots, lotId, 'lot')
  if (lot.state !== 'quarantined')
    throw new LabApiError('invalid-transition', { from: lot.state })
  if (lot.expiresAt <= ctx.now)
    throw new LabApiError('invalid-transition', { from: 'expired' })
  lot.state = lot.quantity > 0 ? 'active' : 'depleted'
  lot.qcStatus = 'passed'
  lot.transactions.unshift(
    txn(ctx, { type: 'release', quantity: 0, balance: lot.quantity, note }),
  )
  audit(db, ctx, 'lot', lot.id, 'released-from-quarantine', {
    reason: note,
    detail: { lot: lot.lotNumber },
  })
  return lot
}

/** Marks a lot expired and writes off the remaining quantity. */
export function markLotExpired(db: LabDb, lotId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'inventory.manage')
  const lot = must(db.lots, lotId, 'lot')
  if (lot.state === 'expired' || lot.state === 'disposed')
    throw new LabApiError('invalid-transition', { from: lot.state })
  const written = lot.quantity
  lot.state = 'expired'
  lot.quantity = 0
  lot.transactions.unshift(
    txn(ctx, { type: 'expire', quantity: -written, balance: 0 }),
  )
  audit(db, ctx, 'lot', lot.id, 'expired', {
    detail: { lot: lot.lotNumber, written },
  })
  return lot
}

export function receiveConsumable(
  db: LabDb,
  id: string,
  input: { quantity: number; expiresAt?: number; note?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'inventory.manage')
  const item = must(db.consumables, id, 'consumable')
  if (input.quantity <= 0)
    throw new LabApiError('validation-failed', { field: 'quantity' })
  item.quantity += input.quantity
  if (input.expiresAt) item.expiresAt = input.expiresAt
  item.transactions.unshift(
    txn(ctx, {
      type: 'receive',
      quantity: input.quantity,
      balance: item.quantity,
      ...(input.note ? { note: input.note } : {}),
    }),
  )
  audit(db, ctx, 'consumable', item.id, 'received', {
    detail: { item: item.name, quantity: input.quantity },
  })
  logActivity(
    db,
    ctx,
    'stock-received',
    { item: item.name, lot: '', quantity: input.quantity },
    '/consumables',
  )
  return item
}

export function adjustConsumable(
  db: LabDb,
  id: string,
  input: { delta: number; reason: AdjustReason; note?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'inventory.manage')
  const item = must(db.consumables, id, 'consumable')
  if (input.delta === 0)
    throw new LabApiError('validation-failed', { field: 'delta' })
  const next = item.quantity + input.delta
  if (next < 0)
    throw new LabApiError('insufficient-stock', { available: item.quantity })
  item.quantity = next
  item.transactions.unshift(
    txn(ctx, {
      type: 'adjust',
      quantity: input.delta,
      balance: next,
      reason: input.reason,
      ...(input.note ? { note: input.note } : {}),
    }),
  )
  audit(db, ctx, 'consumable', item.id, 'adjusted', {
    reason: input.note ? `${input.reason}: ${input.note}` : input.reason,
    detail: { item: item.name, change: input.delta, balance: next },
  })
  return item
}

/**
 * Moves stock to another storage location. A partial lot transfer splits the
 * lot so each location keeps its own balance and history.
 */
export function transferStock(
  db: LabDb,
  input: {
    kind: 'lot' | 'consumable'
    id: string
    toLocationId: string
    quantity: number
    note?: string
  },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'inventory.manage')
  const to = must(db.locations, input.toLocationId, 'location')
  if (!(input.quantity > 0))
    throw new LabApiError('validation-failed', { field: 'quantity' })
  const note = input.note?.trim()
  if (input.kind === 'consumable') {
    const item = must(db.consumables, input.id, 'consumable')
    if (input.quantity > item.quantity)
      throw new LabApiError('insufficient-stock', { available: item.quantity })
    if (item.locationId === to.id)
      throw new LabApiError('validation-failed', { field: 'toLocationId' })
    const from = item.locationId
    item.locationId = to.id
    item.location = to.name
    item.transactions.unshift(
      txn(ctx, {
        type: 'transfer',
        quantity: input.quantity,
        balance: item.quantity,
        ...(from ? { fromLocationId: from } : {}),
        toLocationId: to.id,
        ...(note ? { note } : {}),
      }),
    )
    return item
  }
  const lot = must(db.lots, input.id, 'lot')
  if (lot.state !== 'active' && lot.state !== 'quarantined')
    throw new LabApiError('invalid-transition', { from: lot.state })
  if (input.quantity > lot.quantity)
    throw new LabApiError('insufficient-stock', { available: lot.quantity })
  if (lot.locationId === to.id)
    throw new LabApiError('validation-failed', { field: 'toLocationId' })
  const from = lot.locationId
  const move = {
    type: 'transfer' as const,
    ...(from ? { fromLocationId: from } : {}),
    toLocationId: to.id,
    ...(note ? { note } : {}),
  }
  if (input.quantity === lot.quantity) {
    lot.locationId = to.id
    lot.transactions.unshift(
      txn(ctx, { ...move, quantity: input.quantity, balance: lot.quantity }),
    )
    return lot
  }
  lot.quantity = Math.round((lot.quantity - input.quantity) * 1000) / 1000
  lot.transactions.unshift(
    txn(ctx, { ...move, quantity: -input.quantity, balance: lot.quantity }),
  )
  const split: ReagentLot = {
    ...structuredClone(lot),
    id: uid('lot'),
    quantity: input.quantity,
    initialQuantity: input.quantity,
    locationId: to.id,
    transactions: [
      txn(ctx, { ...move, quantity: input.quantity, balance: input.quantity }),
    ],
  }
  db.lots[split.id] = split
  return split
}

/** Writes off a lot that must not be used (expired, damaged, failed QC). */
export function disposeLot(
  db: LabDb,
  lotId: string,
  note: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'inventory.manage')
  const lot = must(db.lots, lotId, 'lot')
  if (lot.state === 'disposed' || lot.state === 'depleted')
    throw new LabApiError('invalid-transition', { from: lot.state })
  const text = note.trim()
  if (!text) throw new LabApiError('validation-failed', { field: 'note' })
  const written = lot.quantity
  lot.quantity = 0
  lot.state = 'disposed'
  lot.transactions.unshift(
    txn(ctx, { type: 'dispose', quantity: -written, balance: 0, note: text }),
  )
  audit(db, ctx, 'lot', lot.id, 'disposed', {
    reason: text,
    detail: { lot: lot.lotNumber, written },
  })
  return lot
}

/** Records when a reagent pack was opened (in-use stability starts here). */
export function openLot(db: LabDb, lotId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'inventory.manage')
  const lot = must(db.lots, lotId, 'lot')
  if (lot.state !== 'active' || lot.openedAt)
    throw new LabApiError('invalid-transition', { from: lot.state })
  lot.openedAt = ctx.now
  lot.transactions.unshift(
    txn(ctx, { type: 'open', quantity: 0, balance: lot.quantity }),
  )
  audit(db, ctx, 'lot', lot.id, 'opened', { detail: { lot: lot.lotNumber } })
  return lot
}

/**
 * Consumes reagent for tests run on an analyzer, first-expiry-first-out.
 * Returns the reagents that had no usable lot, so the caller can warn: the
 * run itself is not blocked (the lab may use a lot not yet booked in).
 */
export function consumeReagentsFor(
  db: LabDb,
  equipmentId: string,
  testIds: string[],
  note: string | undefined,
  ctx: EngineCtx,
) {
  const missing: string[] = []
  for (const reagent of Object.values(db.reagents)) {
    if (reagent.equipmentId !== equipmentId) continue
    const uses = testIds.filter((t) => reagent.testIds.includes(t)).length
    if (uses === 0) continue
    const lot = Object.values(db.lots)
      .filter((l) => l.reagentId === reagent.id && isLotUsable(l, ctx.now))
      .toSorted((a, b) => a.expiresAt - b.expiresAt)[0]
    if (!lot) {
      missing.push(reagent.name)
      continue
    }
    const qty = Math.min(lot.quantity, uses * (reagent.perTest ?? 1))
    lot.quantity = Math.round((lot.quantity - qty) * 1000) / 1000
    lot.openedAt ??= ctx.now
    if (lot.quantity <= 0) lot.state = 'depleted'
    lot.transactions.unshift(
      txn(ctx, {
        type: 'consume',
        quantity: -qty,
        balance: lot.quantity,
        ...(note ? { note } : {}),
      }),
    )
  }
  return missing
}
