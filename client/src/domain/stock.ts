import { DAY } from './time'
import type {
  Consumable,
  Equipment,
  EquipmentStatus,
  Reagent,
  ReagentLot,
  StockStatus,
} from './types'

export const EXPIRY_WARNING_DAYS = 30

export function lotStatus(
  lot: ReagentLot,
  reagent: Pick<Reagent, 'reorderLevel'>,
  reagentTotal: number,
  now: number,
): StockStatus {
  if (lot.state === 'quarantined') return 'quarantined'
  if (lot.state === 'expired' || lot.expiresAt <= now) return 'expired'
  if (lot.quantity <= 0 || lot.state === 'depleted') return 'out-of-stock'
  if (lot.expiresAt - now <= EXPIRY_WARNING_DAYS * DAY) return 'expiring-soon'
  if (reagentTotal <= reagent.reorderLevel) return 'low-stock'
  return 'in-stock'
}

/** Usable quantity: active, unexpired lots only. */
export function usableQuantity(lots: ReagentLot[], now: number) {
  return lots
    .filter((l) => l.state === 'active' && l.expiresAt > now)
    .reduce((sum, l) => sum + l.quantity, 0)
}

export function isLotUsable(lot: ReagentLot, now: number) {
  return lot.state === 'active' && lot.expiresAt > now && lot.quantity > 0
}

export function consumableStatus(c: Consumable, now: number): StockStatus {
  if (c.expiresAt !== undefined && c.expiresAt <= now) return 'expired'
  if (c.quantity <= 0) return 'out-of-stock'
  if (c.quantity <= c.reorderLevel) return 'low-stock'
  if (
    c.expiresAt !== undefined &&
    c.expiresAt - now <= EXPIRY_WARNING_DAYS * DAY
  )
    return 'expiring-soon'
  return 'in-stock'
}

/** Days of stock left at the current daily usage. */
export function daysOfStock(c: Pick<Consumable, 'quantity' | 'dailyUsage'>) {
  if (c.dailyUsage <= 0) return null
  return Math.floor(c.quantity / c.dailyUsage)
}

/** Stored status, upgraded to calibration-due when the date has passed. */
export function equipmentStatus(e: Equipment, now: number): EquipmentStatus {
  if (e.status === 'operational' && e.calibrationDueAt <= now)
    return 'calibration-due'
  return e.status
}

/** Whether new patient work can be sent to the analyzer. */
export function isEquipmentUsable(e: Equipment, now: number) {
  if (e.connection === 'offline') return false
  const status = equipmentStatus(e, now)
  return status !== 'out-of-service' && status !== 'maintenance'
}

export function isStockWarning(status: StockStatus) {
  return status !== 'in-stock'
}
