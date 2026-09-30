import { LucideProvider } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'
import { toneStyle, type IconTone } from '@/lib/icon-tones'
import { TrendLine } from '@/components/charts/micro'
import { IconGlyph } from '@/components/ui/icon-tile'

type TileTone = 'blue' | 'teal' | 'violet' | 'amber' | 'red'

/**
 * A soft gradient of the tile's own hue: the top-left, where the text sits,
 * stays on the full tile colour so white text keeps its contrast.
 */
function tileBackground(tone: TileTone) {
  return {
    backgroundImage: `linear-gradient(145deg, var(--tile-${tone}) 0%, var(--tile-${tone}) 45%, color-mix(in oklab, var(--tile-${tone}) 80%, #ffffff) 100%)`,
  }
}

/**
 * A snapshot tile (design system 9.3): a deliberate focal point with white
 * text on a theme-invariant fill and a transparent glyph. Every number is
 * counted from records.
 */
export function SnapshotTile({
  to,
  tone,
  icon,
  label,
  value,
  detail,
  change,
  trend,
  trendLabel,
}: {
  to: string
  tone: TileTone
  icon: ReactNode
  label: string
  value: ReactNode
  detail?: ReactNode
  change?: ReactNode
  trend?: number[]
  trendLabel?: string
}) {
  return (
    <Link
      to={to}
      style={tileBackground(tone)}
      className="focus-ring group relative flex min-h-11 min-w-0 flex-col gap-2.5 overflow-hidden rounded-xl p-4 text-white shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-md"
    >
      <span className="relative flex items-start justify-between gap-2">
        <span aria-hidden className="duo-on-fill inline-flex text-white/95">
          <LucideProvider size={24} strokeWidth={1.75}>
            {icon}
          </LucideProvider>
        </span>
        {change ? <span className="text-xs">{change}</span> : null}
      </span>
      <span className="relative min-w-0">
        <span className="block text-3xl leading-none font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        <span className="mt-1.5 block text-sm font-medium opacity-95">
          {label}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-xs leading-relaxed opacity-80">
            {detail}
          </span>
        ) : null}
      </span>
      {trend && trend.length > 1 ? (
        <span className="relative mt-auto block text-white/90">
          <TrendLine values={trend} height={32} />
          {trendLabel ? <span className="sr-only">{trendLabel}</span> : null}
        </span>
      ) : null}
    </Link>
  )
}

/** A white staff KPI card (design system 9.4) with an optional trend line. */
export function KpiCard({
  to,
  icon,
  tone = 'blue',
  label,
  value,
  detail,
  change,
  trend,
  trendLabel,
  alert,
}: {
  to: string
  icon: ReactNode
  /** Destination hue of the glyph and trend line. */
  tone?: IconTone
  label: string
  value: ReactNode
  detail?: ReactNode
  change?: ReactNode
  trend?: number[]
  trendLabel?: string
  /** Something here needs action: a critical edge and value. */
  alert?: boolean
}) {
  return (
    <Link
      to={to}
      style={toneStyle(alert ? 'red' : tone)}
      className={cn(
        'focus-ring group tinted-surface flex min-w-0 flex-col rounded-xl border bg-surface p-4 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-card-md',
        alert && 'border-danger-text/35',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'truncate text-xs font-medium',
            alert ? 'text-danger-text' : 'text-fg-subtle',
          )}
        >
          {label}
        </span>
        <IconGlyph
          icon={icon}
          tone={alert ? 'red' : tone}
          size={22}
          className="transition-transform duration-200 group-hover:scale-110"
        />
      </span>
      <span
        className={cn(
          'mt-2 block text-2xl leading-none font-semibold tracking-tight tabular-nums',
          alert ? 'text-danger-text' : 'text-fg',
        )}
      >
        {value}
      </span>
      {change || detail ? (
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-subtle">
          {change}
          {detail}
        </span>
      ) : null}
      {trend && trend.length > 1 ? (
        <span className="duo-icon mt-3 block">
          <TrendLine values={trend} height={34} />
          {trendLabel ? <span className="sr-only">{trendLabel}</span> : null}
        </span>
      ) : null}
    </Link>
  )
}
