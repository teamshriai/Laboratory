import type { LabSettings } from '@/domain/types'

export type EscalationTier = LabSettings['criticalEscalation'][number]

export const ESCALATION_MIN = 5
export const ESCALATION_MAX = 1440
export const MAX_TIERS = 4

/**
 * One message key (or nothing) per tier: minutes must be whole, within
 * 5 to 1440, and each tier later than the one before (the engine checks
 * the same).
 */
export function escalationErrors(tiers: EscalationTier[]) {
  return tiers.map((tier, i) => {
    const m = tier.afterMin
    if (!Number.isInteger(m) || m < ESCALATION_MIN || m > ESCALATION_MAX)
      return 'escalationMinutesRange' as const
    const before = tiers[i - 1]
    if (before && m <= before.afterMin) return 'escalationOrder' as const
    return undefined
  })
}

/** The next tier to add: later than the last, going one level up. */
export function nextTier(tiers: EscalationTier[]): EscalationTier {
  const last = tiers.at(-1)
  if (!last) return { afterMin: 30, to: 'lab-manager' }
  const after = Number.isFinite(last.afterMin) ? last.afterMin : 0
  return {
    afterMin: Math.min(ESCALATION_MAX, Math.max(ESCALATION_MIN, after + 30)),
    to: 'duty-pathologist',
  }
}
