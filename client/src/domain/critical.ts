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
