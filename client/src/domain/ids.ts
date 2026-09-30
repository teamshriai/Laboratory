import { istDayCompact } from './time'

/**
 * Next identifier in a sequence such as "LAB-20260928-00184". Counters are
 * derived from the highest existing suffix for the prefix, so they never drift
 * from the data.
 */
export function nextSequence(
  existing: Iterable<string | null | undefined>,
  prefix: string,
  width: number,
) {
  let max = 0
  for (const id of existing) {
    if (!id || !id.startsWith(prefix)) continue
    const n = Number(id.slice(prefix.length))
    if (Number.isInteger(n) && n > max) max = n
  }
  return prefix + String(max + 1).padStart(width, '0')
}

export const accessionPrefix = (at: number, prefix = 'LAB') =>
  `${prefix}-${istDayCompact(at)}-`
export const orderPrefix = (at: number) => `ORD-${istDayCompact(at)}-`
export const reportPrefix = (at: number) => `RPT-${istDayCompact(at)}-`
export const UHID_PREFIX = 'SHRI-'

let counter = 0
/** Internal entity id (not shown to users). */
export function uid(prefix: string) {
  counter = (counter + 1) % 1_000_000
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}${Math.random().toString(36).slice(2, 6)}`
}
