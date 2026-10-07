// Modules a laboratory can switch on, and presets by size. A switched-off
// module leaves navigation and its routes; its data stays untouched.

import { MODULES, type ModuleId, type SizeTier } from './types'

/** What each size starts with; the lab can change any module afterwards. */
export const TIER_MODULES: Record<SizeTier, readonly ModuleId[]> = {
  // A single-room lab: billing and messages, no imaging or interfaces.
  small: ['billing', 'messaging', 'quality', 'compliance'],
  medium: [
    'billing',
    'messaging',
    'homeCollection',
    'inventory',
    'quality',
    'compliance',
    'doctorPortal',
  ],
  large: MODULES,
}

export function modulesForTier(tier: SizeTier): Record<ModuleId, boolean> {
  const on = new Set(TIER_MODULES[tier])
  return Object.fromEntries(MODULES.map((m) => [m, on.has(m)])) as Record<
    ModuleId,
    boolean
  >
}
