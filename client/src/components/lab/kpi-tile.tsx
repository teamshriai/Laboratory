import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'
import { toneStyle, type IconTone } from '@/lib/icon-tones'
import { TrendLine } from '@/components/charts/micro'
import { IconGlyph } from '@/components/ui/icon-tile'

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
