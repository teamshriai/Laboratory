import type { CriticalAlert, CriticalState } from './types'

/** The state shown for a critical value, derived from what was recorded. */
export function criticalState(
  alert: Pick<CriticalAlert, 'status' | 'attempts' | 'escalatedAt'>,
): CriticalState {
  if (alert.status === 'voided') return 'voided'
  if (alert.status === 'acknowledged') return 'acknowledged'
  if (alert.escalatedAt) return 'escalated'
  if (alert.status === 'notified') return 'notified'
  return alert.attempts.length > 0 ? 'contacting' : 'open'
}

/** Still needs action from the lab (not acknowledged, not voided). */
export function isCriticalPending(alert: Pick<CriticalAlert, 'status'>) {
  return alert.status === 'open' || alert.status === 'notified'
}

/**
 * Past the notification window without anyone being reached: the case for
 * escalation. `limitMin` comes from the lab settings.
 */
export function isCriticalOverdue(
  alert: Pick<CriticalAlert, 'status' | 'detectedAt'>,
  now: number,
  limitMin: number,
) {
  return alert.status === 'open' && now - alert.detectedAt > limitMin * 60_000
}

const TITLES = /^(dr|dr\.|sister|sr|sr\.|mr|mr\.|mrs|mrs\.|ms|ms\.|nurse)$/i

/**
 * A recipient recorded by full name (CAP COM.30000: a first name alone is
 * not enough). Titles and a role in brackets are ignored when counting.
 */
export function isFullName(text: string) {
  const words = text
    .replace(/\(.*?\)/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !TITLES.test(w))
  return (
    words.filter((w) => w.replace(/[^\p{L}]/gu, '').length >= 1).length >= 2
  )
}

/**
 * The escalation step a critical value has reached: the last tier whose
 * time has passed while it is still not communicated (tiers in order).
 */
export function escalationStep<T extends { afterMin: number }>(
  minutesOpen: number,
  tiers: readonly T[],
): { index: number; tier: T } | null {
  let reached: { index: number; tier: T } | null = null
  tiers.forEach((tier, index) => {
    if (minutesOpen >= tier.afterMin) reached = { index, tier }
  })
  return reached
}
