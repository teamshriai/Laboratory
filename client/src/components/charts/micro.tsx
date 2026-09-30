import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { TooltipBox } from './chart-kit'

/**
 * Compact SVG marks for the Overview: a gauge ring, a donut, a countdown
 * ring and a fluid trend line. Colours come from theme tokens; the ring and
 * donut draw in once on mount (design system 11.2 "Progress ring"), which the
 * global reduced-motion rule clamps.
 */

const ARC_DRAW =
  'motion-safe:animate-[ring-draw_1.2s_var(--ease-premium)_0.2s_both]'

/** A gauge: value 0..1 around a circle, with an optional target tick. */
export function Ring({
  value,
  target,
  size = 132,
  stroke = 12,
  tone = 'accent',
  label,
  children,
}: {
  value: number | null
  target?: number
  size?: number
  stroke?: number
  tone?: 'accent' | 'warning' | 'danger' | 'success'
  /** Accessible summary, e.g. "TAT on time 93.3%, target 90%". */
  label: string
  children?: ReactNode
}) {
  const gid = `ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value ?? 0))
  const tickAngle = target === undefined ? null : target * 2 * Math.PI
  const cx = size / 2
  return (
    <div
      role="img"
      aria-label={label}
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--chart-3)" />
            <stop offset="1" stopColor="var(--chart-1)" />
          </linearGradient>
        </defs>
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-3"
        />
        {value !== null ? (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            style={{ '--ring-c': c } as CSSProperties}
            stroke={tone === 'accent' ? `url(#${gid})` : undefined}
            className={cn(
              ARC_DRAW,
              tone === 'warning' && 'stroke-warning',
              tone === 'danger' && 'stroke-danger',
              tone === 'success' && 'stroke-success',
            )}
          />
        ) : null}
        {tickAngle !== null ? (
          <line
            x1={cx + (r - stroke / 2 - 3) * Math.cos(tickAngle)}
            y1={cx + (r - stroke / 2 - 3) * Math.sin(tickAngle)}
            x2={cx + (r + stroke / 2 + 3) * Math.cos(tickAngle)}
            y2={cx + (r + stroke / 2 + 3) * Math.sin(tickAngle)}
            strokeWidth={2.5}
            strokeLinecap="round"
            className="stroke-fg"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {children}
      </div>
    </div>
  )
}

export interface DonutSegment {
  key: string
  label: string
  value: number
  /** A chart token, e.g. var(--chart-1). */
  color: string
}

/** Part-to-whole ring with a 2px surface gap and a hover readout per segment. */
export function Donut({
  segments,
  size = 148,
  thickness = 20,
  label,
  formatValue,
  children,
}: {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  label: string
  formatValue: (value: number, share: number) => string
  children?: ReactNode
}) {
  const [active, setActive] = useState<string | null>(null)
  const total = segments.reduce((n, s) => n + s.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const gap =
    total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2 : 0
  const arcs = segments.reduce<
    { seg: DonutSegment; offset: number; length: number }[]
  >((acc, seg) => {
    const prev = acc.at(-1)
    const offset = prev ? prev.offset + prev.length + gap : 0
    const length = total > 0 ? Math.max(0, (seg.value / total) * c - gap) : 0
    return [...acc, { seg, offset, length }]
  }, [])
  const hovered = arcs.find((a) => a.seg.key === active)
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      onMouseLeave={() => setActive(null)}
    >
      <svg
        role="img"
        aria-label={label}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-surface-3"
        />
        {arcs.map(({ seg, offset, length }) =>
          length > 0 ? (
            <circle
              key={seg.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={active === seg.key ? thickness + 4 : thickness}
              strokeDasharray={`${length} ${c - length}`}
              strokeDashoffset={-offset}
              onMouseEnter={() => setActive(seg.key)}
              className="cursor-default transition-[stroke-width] duration-150"
            />
          ) : null,
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        {children}
      </div>
      {hovered ? (
        <div className="absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2">
          <TooltipBox
            title={hovered.seg.label}
            rows={[
              {
                key: 'v',
                label: hovered.seg.label,
                value: formatValue(
                  hovered.seg.value,
                  total ? hovered.seg.value / total : 0,
                ),
                color: hovered.seg.color,
                shape: 'rect',
              },
            ]}
          />
        </div>
      ) : null}
    </div>
  )
}

/** A small ring filling toward a time limit; minutes stay as visible text. */
export function CountdownRing({
  elapsedMin,
  limitMin,
  size = 40,
}: {
  elapsedMin: number
  limitMin: number
  size?: number
}) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = Math.min(1, elapsedMin / limitMin)
  const over = elapsedMin > limitMin
  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className={cn(
            over
              ? 'stroke-danger'
              : ratio >= 0.5
                ? 'stroke-warning'
                : 'stroke-accent',
          )}
        />
      </svg>
      <span
        className={cn(
          'absolute text-2xs font-semibold tabular-nums',
          over ? 'text-danger-text' : 'text-fg',
        )}
      >
        {Math.round(elapsedMin)}
      </span>
    </span>
  )
}

/**
 * A trend line that fills its container's width. Decorative: the value and
 * change beside it carry the meaning, so it is hidden from assistive tech.
 */
export function TrendLine({
  values,
  className,
  height = 36,
  area = true,
}: {
  values: number[]
  className?: string
  height?: number
  area?: boolean
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  if (values.length < 2) return null
  const w = 100
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map(
    (v, i) =>
      [
        (i / (values.length - 1)) * w,
        height - 3 - ((v - min) / span) * (height - 8),
      ] as const,
  )
  const line = pts
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={cn('block w-full overflow-visible', className)}
      style={{ height }}
    >
      {area ? (
        <>
          <defs>
            <linearGradient id={`tl-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L${w},${height} L0,${height} Z`}
            fill={`url(#tl-${id})`}
          />
        </>
      ) : null}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
