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
        'focus-ring group tinted-surface @container flex min-w-0 flex-col rounded-xl border bg-surface px-3.5 py-3 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-card-md',
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
          size={16}
          className="transition-transform duration-200 group-hover:scale-110"
        />
      </span>
      {/* Figures on the left; the trend beside them once the card is wide
          enough, under them on a phone. */}
      <span className="mt-1.5 flex flex-col gap-1.5 @[14rem]:flex-row @[14rem]:items-end @[14rem]:gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span
              className={cn(
                'text-xl leading-none font-semibold tracking-tight tabular-nums',
                alert ? 'text-danger-text' : 'text-fg',
              )}
            >
              {value}
            </span>
            {change ? <span className="text-2xs">{change}</span> : null}
          </span>
          {detail ? (
            <span className="mt-1 block truncate text-2xs text-fg-subtle">
              {detail}
            </span>
          ) : null}
        </span>
        {trend && trend.length > 1 ? (
          <span className="duo-icon block w-full shrink-0 @[14rem]:w-[38%] @[14rem]:max-w-36">
            <TrendLine values={trend} height={22} />
            {trendLabel ? <span className="sr-only">{trendLabel}</span> : null}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
