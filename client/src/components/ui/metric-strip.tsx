import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'

export interface Metric {
  key: string
  label: string
  value: ReactNode
  /** Short supporting line under the value, e.g. "11 over target now". */
  detail?: ReactNode
  change?: ReactNode
  href?: string
  /** Draws the value in the danger colour (with the label) when it needs action. */
  alert?: boolean
}

// Static class names so Tailwind can see them: one row from lg (up to 5) and xl (up to 7).
const COLUMNS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-3 xl:grid-cols-6',
  7: 'lg:grid-cols-4 xl:grid-cols-7',
}

/**
 * One row of headline figures separated by hairlines: the design system's
 * staff KPI tiles (9.4) joined into a single card for dense screens.
 */
export function MetricStrip({
  items,
  className,
}: {
  items: Metric[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-surface shadow-card',
        className,
      )}
    >
      <dl
        className={cn(
          '-mr-px -mb-px grid grid-cols-2 sm:grid-cols-3',
          COLUMNS[Math.min(items.length, 7)],
        )}
      >
        {items.map((m) => {
          const body = (
            <>
              <dt
                className={cn(
                  'text-xs font-medium',
                  m.alert ? 'text-danger-text' : 'text-fg-subtle',
                )}
              >
                {m.label}
              </dt>
              <dd
                className={cn(
                  'mt-2 text-figure font-semibold tabular-nums',
                  m.alert ? 'text-danger-text' : 'text-fg',
                )}
              >
                {m.value}
              </dd>
              {m.change || m.detail ? (
                <dd className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                  {m.change}
                  {m.detail}
                </dd>
              ) : null}
            </>
          )
          const cell =
            'min-w-0 border-line p-4 [&:not(:last-child)]:border-r max-sm:[&:nth-child(2n)]:border-r-0'
          return m.href ? (
            <Link
              key={m.key}
              to={m.href}
              className={cn(cell, 'block transition-colors hover:bg-surface-2')}
            >
              {body}
            </Link>
          ) : (
            <div key={m.key} className={cell}>
              {body}
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/** Change against a comparison period, with an arrow and a text alternative. */
export function Change({
  current,
  previous,
  higherIsBetter = true,
  mode = 'relative',
  label,
  inverse,
}: {
  current: number | null
  previous: number | null | undefined
  higherIsBetter?: boolean
  /** relative: percent change; absolute: difference in units; points: percentage points. */
  mode?: 'relative' | 'absolute' | 'points'
  label?: string
  /** On a solid tile: white text, direction shown by the arrow only. */
  inverse?: boolean
}) {
  const f = useFormat()
  if (current === null || previous === null || previous === undefined)
    return null
  if (mode === 'relative' && previous === 0) return null
  const delta =
    mode === 'relative' ? (current - previous) / previous : current - previous
  const flat = Math.abs(delta) < (mode === 'relative' ? 0.005 : 0.05)
  const good = higherIsBetter ? delta > 0 : delta < 0
  const text =
    mode === 'relative'
      ? f.percent(Math.abs(delta))
      : mode === 'points'
        ? `${Math.abs(delta).toFixed(1)} pt`
        : f.number(Math.abs(Math.round(delta)))
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium tabular-nums',
        inverse
          ? 'text-white'
          : flat
            ? 'text-fg-muted'
            : good
              ? 'text-success-text'
              : 'text-danger-text',
      )}
      aria-label={
        label
          ? `${label}: ${delta > 0 ? '+' : delta < 0 ? '-' : ''}${text}`
          : undefined
      }
    >
      {flat ? (
        <MinusIcon className="size-3" aria-hidden />
      ) : delta > 0 ? (
        <ArrowUpRightIcon className="size-3" aria-hidden />
      ) : (
        <ArrowDownRightIcon className="size-3" aria-hidden />
      )}
      {text}
      {label ? (
        <span
          className={cn(
            'font-normal',
            inverse ? 'text-white/75' : 'text-fg-subtle',
          )}
        >
          {' '}
          {label}
        </span>
      ) : null}
    </span>
  )
}
