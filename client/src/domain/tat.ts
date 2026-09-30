import { HOUR } from './time'
import type { OrderItem, Priority, Sample } from './types'

export type TatState =
  'not-started' | 'on-track' | 'approaching' | 'breached' | 'met' | 'missed'

export interface TatInfo {
  state: TatState
  startAt: number | null
  endAt: number | null
  elapsedMs: number
  targetMs: number
  /** Elapsed as a fraction of target (1 = at the target). */
  ratio: number
}

export const APPROACHING_RATIO = 0.75

/**
 * The fraction of the target at which work counts as "at risk". The lab sets
 * it in Settings; the API applies it before every read so all screens agree.
 */
let approachingRatio = APPROACHING_RATIO

export function setTatWarnRatio(ratio: number) {
  if (ratio > 0 && ratio < 1) approachingRatio = ratio
}

export function tatHoursFor(
  test: { tatHours: number; statTatHours: number },
  priority: Priority,
) {
  if (priority === 'stat') return test.statTatHours
  if (priority === 'urgent')
    return Math.max(
      test.statTatHours,
      Math.round(test.tatHours * 0.6 * 10) / 10,
    )
  return test.tatHours
}

/** Laboratory TAT: from receipt in the lab until validation. */
export function itemTat(
  item: Pick<OrderItem, 'tatHours' | 'validatedAt'>,
  sample: Pick<Sample, 'receivedAt'> | undefined,
  now: number,
): TatInfo {
  const targetMs = item.tatHours * HOUR
  const startAt = sample?.receivedAt ?? null
  if (startAt === null)
    return {
      state: 'not-started',
      startAt,
      endAt: null,
      elapsedMs: 0,
      targetMs,
      ratio: 0,
    }
  const endAt = item.validatedAt ?? null
  const elapsedMs = Math.max(0, (endAt ?? now) - startAt)
  const ratio = targetMs > 0 ? elapsedMs / targetMs : 0
  let state: TatState
  if (endAt !== null) state = ratio <= 1 ? 'met' : 'missed'
  else if (ratio > 1) state = 'breached'
  else if (ratio >= approachingRatio) state = 'approaching'
  else state = 'on-track'
  return { state, startAt, endAt, elapsedMs, targetMs, ratio }
}

/** The most urgent TAT among a sample's live items. */
export function worstTat(infos: TatInfo[]): TatInfo | null {
  if (infos.length === 0) return null
  const order: TatState[] = [
    'breached',
    'approaching',
    'on-track',
    'missed',
    'met',
    'not-started',
  ]
  return infos.toSorted((a, b) => {
    const s = order.indexOf(a.state) - order.indexOf(b.state)
    if (s !== 0) return s
    return b.ratio - a.ratio
  })[0]!
}
