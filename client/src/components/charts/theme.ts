// Shared chart styling for the QC, TAT and analytics screens. Everything
// resolves to theme tokens so charts follow light and dark mode.

/** Categorical series in the validated fixed order; slot 6 is the neutral comparison. */
export const SERIES = {
  1: { color: 'var(--chart-1)', bg: 'bg-chart-1' },
  2: { color: 'var(--chart-2)', bg: 'bg-chart-2' },
  3: { color: 'var(--chart-3)', bg: 'bg-chart-3' },
  4: { color: 'var(--chart-4)', bg: 'bg-chart-4' },
  5: { color: 'var(--chart-5)', bg: 'bg-chart-5' },
  6: { color: 'var(--chart-6)', bg: 'bg-chart-6' },
} as const

export type SeriesSlot = keyof typeof SERIES

export const SERIES_ORDER = [1, 2, 3, 4, 5] as const

export const GRID_PROPS = {
  stroke: 'var(--chart-grid)',
  strokeDasharray: '3 4',
  vertical: false,
} as const

export const AXIS_TICK = { fill: 'var(--fg-subtle)', fontSize: 10 } as const

export const AXIS_PROPS = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: false,
} as const

export const LINE_CURSOR = {
  stroke: 'var(--line-strong)',
  strokeWidth: 1,
} as const
export const BAR_CURSOR = { fill: 'var(--surface-3)', opacity: 0.55 } as const

/** Surface ring around markers so they stay legible where they cross lines. */
export const ACTIVE_DOT = {
  r: 4,
  stroke: 'var(--surface)',
  strokeWidth: 2,
} as const

export const BAR_RADIUS_TOP: [number, number, number, number] = [4, 4, 0, 0]
export const BAR_RADIUS_END: [number, number, number, number] = [0, 4, 4, 0]

export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const

/** Noon IST on a YYYY-MM-DD day, safe to format as that IST date. */
export function dayMs(day: string) {
  return Date.parse(`${day}T12:00:00+05:30`)
}

/** Row behind the hovered position of a Recharts tooltip. */
export function activeRow<T>(props: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
}): T | undefined {
  if (!props.active) return undefined
  return props.payload?.[0]?.payload as T | undefined
}

export function sum<T>(rows: readonly T[], pick: (row: T) => number) {
  return rows.reduce((n, r) => n + pick(r), 0)
}

/** Relative change; null when there is no usable base. */
export function relativeChange(current: number, previous: number | null) {
  if (previous === null || previous === 0) return null
  return (current - previous) / previous
}
