import { criticalRangeParts } from '@/domain/reference-ranges'
import type { RangeSnapshot } from '@/domain/types'

/** "< 7 or > 20" with a translated conjunction. */
export function formatCriticalRangeParts(
  range: RangeSnapshot | null | undefined,
  or: string,
) {
  return criticalRangeParts(range).join(` ${or} `)
}
