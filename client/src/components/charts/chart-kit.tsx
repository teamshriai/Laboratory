import { ChartColumnIcon, TableIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/toggles'
import type { IconTone } from '@/lib/icon-tones'

export type MarkShape =
  'rect' | 'line' | 'dot' | 'triangle' | 'diamond' | 'dash'

/** Swatch that mirrors the mark it identifies (rect for bars, line for lines). */
export function LegendMark({
  shape,
  color,
  className,
}: {
  shape: MarkShape
  color: string
  className?: string
}) {
  if (shape === 'triangle' || shape === 'diamond' || shape === 'dot')
    return (
      <svg
        viewBox="0 0 12 12"
        className={cn('size-3 shrink-0', className)}
        aria-hidden
      >
        {shape === 'triangle' ? (
          <path d="M6 1.2 11 10.4H1Z" fill={color} />
        ) : null}
        {shape === 'diamond' ? (
          <path d="M6 .8 11.2 6 6 11.2.8 6Z" fill={color} />
        ) : null}
        {shape === 'dot' ? <circle cx="6" cy="6" r="4" fill={color} /> : null}
      </svg>
    )
  if (shape === 'dash')
    return (
      <svg
        viewBox="0 0 14 4"
        className={cn('h-1 w-3.5 shrink-0', className)}
        aria-hidden
      >
        <line
          x1="0"
          x2="14"
          y1="2"
          y2="2"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="3 2"
        />
      </svg>
    )
  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0',
        shape === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-sm',
        className,
      )}
      style={{ background: color }}
    />
  )
}

export interface LegendItem {
  key: string
  label: ReactNode
  color: string
  shape: MarkShape
}

export function ChartLegend({
  items,
  className,
}: {
  items: LegendItem[]
  className?: string
}) {
  return (
    <ul
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-muted',
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.key} className="inline-flex items-center gap-1.5">
          <LegendMark shape={item.shape} color={item.color} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export interface TooltipRow {
  key: string
  label: ReactNode
  value: ReactNode
  color?: string
  shape?: MarkShape
  muted?: boolean
}

/** Hover readout shared by every chart: the value leads, the series name follows. */
export function TooltipBox({
  title,
  rows,
  children,
}: {
  title: ReactNode
  rows?: TooltipRow[]
  children?: ReactNode
}) {
  return (
    <div className="pointer-events-none min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-overlay">
      <p className="mb-1.5 font-semibold text-fg">{title}</p>
      {rows?.length ? (
        <ul className="grid gap-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className={cn(
                'flex items-center gap-2',
                row.muted ? 'text-fg-muted' : 'text-fg',
              )}
            >
              {row.color ? (
                <LegendMark shape={row.shape ?? 'line'} color={row.color} />
              ) : null}
              <span className="flex-1 text-fg-muted">{row.label}</span>
              <span className="font-semibold whitespace-nowrap tabular-nums">
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  )
}

export type ChartView = 'chart' | 'table'

export function ViewToggle({
  value,
  onValueChange,
}: {
  value: ChartView
  onValueChange: (view: ChartView) => void
}) {
  const t = useT('common')
  return (
    <Segmented
      size="sm"
      aria-label={t('viewAs')}
      value={value}
      onValueChange={onValueChange}
      options={[
        {
          value: 'chart',
          label: <span className="sr-only">{t('viewChart')}</span>,
          icon: <ChartColumnIcon />,
        },
        {
          value: 'table',
          label: <span className="sr-only">{t('viewTable')}</span>,
          icon: <TableIcon />,
        },
      ]}
    />
  )
}

/**
 * Card holding one chart and its table twin. The chart only mounts while it
 * is the visible view, so Recharts never measures a hidden container.
 */
export function ChartCard({
  icon,
  tone,
  title,
  description,
  legend,
  summary,
  chart,
  table,
  className,
  bodyClassName,
}: {
  icon: ReactNode
  tone?: IconTone
  title: ReactNode
  description?: ReactNode
  legend?: ReactNode
  summary?: ReactNode
  chart: ReactNode
  table: ReactNode
  className?: string
  bodyClassName?: string
}) {
  const [view, setView] = useState<ChartView>('chart')
  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <CardHeader
        icon={icon}
        {...(tone ? { tone } : {})}
        title={title}
        description={description}
        action={<ViewToggle value={view} onValueChange={setView} />}
      />
      <CardBody
        className={cn('flex flex-1 flex-col gap-4 pt-0', bodyClassName)}
      >
        {summary}
        {view === 'chart' ? (
          <div className="grid gap-3">
            {legend}
            {chart}
          </div>
        ) : (
          table
        )}
      </CardBody>
    </Card>
  )
}

export interface TableColumn {
  key: string
  header: ReactNode
  align?: 'left' | 'right'
}

/** Compact data table used as the text alternative of a chart. */
export function ChartTable({
  caption,
  columns,
  rows,
  height,
}: {
  caption: string
  columns: TableColumn[]
  rows: { id: string; cells: Record<string, ReactNode> }[]
  height: number
}) {
  return (
    <div
      className="scrollbar-thin overflow-auto rounded-lg border border-line"
      style={{ height }}
    >
      <table className="w-full border-separate border-spacing-0 text-meta">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'sticky top-0 z-10 border-b border-line bg-surface-2 px-3 py-2 text-xs font-medium whitespace-nowrap text-fg-muted',
                  c.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-2/60">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'border-b border-line/70 px-3 py-1.5 whitespace-nowrap text-fg tabular-nums',
                    c.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {row.cells[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Chart frame with a fixed height; dims while newer data loads instead of flashing. */
export function ChartFrame({
  height,
  label,
  stale,
  children,
}: {
  height: number
  label: string
  stale?: boolean
  children: ReactNode
}) {
  return (
    <figure
      aria-label={label}
      className={cn('m-0 min-w-0 transition-opacity', stale && 'opacity-60')}
      style={{ height }}
    >
      {children}
    </figure>
  )
}
