import type { ContainerId } from './types'

/**
 * The order in which tubes are filled at one venipuncture (CLSI GP41), so
 * additives do not carry over: blood culture first, then citrate, serum,
 * heparin, EDTA and fluoride. Non-blood containers come last.
 */
export const ORDER_OF_DRAW: readonly ContainerId[] = [
  'culture-bottle',
  'citrate',
  'plain',
  'sst',
  'heparin',
  'edta',
  'fluoride',
  'urine',
  'stool',
  'sterile',
  'formalin',
  'slide',
]

export function byOrderOfDraw<T>(
  items: readonly T[],
  container: (item: T) => ContainerId,
): T[] {
  return items.toSorted(
    (a, b) =>
      ORDER_OF_DRAW.indexOf(container(a)) - ORDER_OF_DRAW.indexOf(container(b)),
  )
}

/** Indian PIN code: 6 digits, not starting with 0. */
export const isPinCode = (value: string) => /^[1-9]\d{5}$/.test(value.trim())

/** Indian mobile number: +91 optional, 10 digits starting 6-9. */
export function normaliseIndianMobile(value: string): string | null {
  const digits = value
    .replace(/[\s-]/g, '')
    .replace(/^(\+91|0091|91)(?=\d{10}$)/, '')
  return /^[6-9]\d{9}$/.test(digits)
    ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
    : null
}

/** ABHA number: 14 digits, written 12-3456-7890-1234. */
export function normaliseAbhaNumber(value: string): string | null {
  const digits = value.replace(/[\s-]/g, '')
  return /^\d{14}$/.test(digits)
    ? `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`
    : null
}

/** ABHA address: user@abdm (or @sbx in the sandbox). */
export const isAbhaAddress = (value: string) =>
  /^[a-z0-9][a-z0-9._]{2,31}@(abdm|sbx)$/i.test(value.trim())
