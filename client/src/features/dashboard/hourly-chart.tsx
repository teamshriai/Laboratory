import { useId, useState, type KeyboardEvent } from 'react'
import { istHour } from '@/domain/time'
import { useElementSize } from '@/hooks/use-element-size'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { DashboardView } from '@/services/lab-api'
import { ChartLegend, TooltipBox } from '@/components/charts/chart-kit'
import { ChartColumnIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SoftIconTile } from '@/components/ui/icon-tile'

const pad2 = (n: number) => String(n).padStart(2, '0')

export function HourlyChart({ hourly }: { hourly: DashboardView['hourly'] }) {
  const t = useT('dashboard')
  const f = useFormat()
  const now = useNow()
  const [ref, size] = useElementSize<HTMLDivElement>()
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [active, setActive] = useState<number | null>(null)
  const data = hourly.filter((h) => h.hour >= 6)
  const currentHour = istHour(now)
  const max = Math.max(4, ...data.map((d) => Math.max(d.today, d.yesterday)))
  const step = max > 20 ? 10 : 5
  const top = Math.ceil(max / step) * step
  const width = size.width
  const height = Math.max(200, size.height)
  const pad = { top: 16, right: 12, bottom: 26, left: 32 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const band = innerW / Math.max(1, data.length)
  const barW = Math.min(22, band * 0.56)
  const y = (v: number) => pad.top + innerH - (v / top) * innerH
  const x = (i: number) => pad.left + band * i + band / 2
  const peak = data.reduce(
    (best, d, i) => (d.today > (data[best]?.today ?? -1) ? i : best),
    0,
  )
  const line = data
    .map(
      (d, i) =>
        `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.yesterday).toFixed(1)}`,
    )
    .join(' ')
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step)
  const shown = active ?? null
  const hovered = shown !== null ? data[shown] : undefined

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      ev.preventDefault()
      const next =
        (active ?? data.length - 1) + (ev.key === 'ArrowRight' ? 1 : -1)
      setActive(Math.max(0, Math.min(data.length - 1, next)))
    }
    if (ev.key === 'Escape') setActive(null)
  }

  return (
    <Card className="flex h-full min-h-80 flex-col px-4 pt-3.5 pb-4 sm:px-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-fg">
          <SoftIconTile icon={<ChartColumnIcon />} tone="blue" size="md" />
          {t('hourly')}
        </h2>
        <ChartLegend
          items={[
            {
              key: 'today',
              label: t('today'),
              color: 'var(--chart-1)',
              shape: 'rect',
            },
            {
              key: 'yesterday',
              label: t('yesterday'),
              color: 'var(--chart-2)',
              shape: 'line',
            },
          ]}
        />
      </div>
      <div
        ref={ref}
        className="relative min-h-52 flex-1 rounded-lg outline-offset-2"
        tabIndex={0}
        role="group"
        aria-label={`${t('hourly')}. ${t('hourlyKeys')}`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {size.width > 0 ? (
          <svg
            width={width}
            height={height}
            className="absolute inset-0"
            aria-hidden
            onMouseLeave={() => setActive(null)}
          >
            <defs>
              <linearGradient id={`bar-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-1)" />
                <stop
                  offset="1"
                  stopColor="var(--chart-1)"
                  stopOpacity="0.45"
                />
              </linearGradient>
              <linearGradient id={`now-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-3)" />
                <stop offset="1" stopColor="var(--chart-1)" />
              </linearGradient>
              <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0"
                  stopColor="var(--chart-2)"
                  stopOpacity="0.16"
                />
                <stop offset="1" stopColor="var(--chart-2)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="var(--chart-grid)"
                  strokeDasharray={v === 0 ? undefined : '3 4'}
                />
                <text
                  x={pad.left - 8}
                  y={y(v) + 3.5}
                  textAnchor="end"
                  className="fill-fg-subtle text-[10px] tabular-nums"
                >
                  {v}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const isNow = d.hour === currentHour
              return (
                <g key={d.hour}>
                  <rect
                    x={x(i) - barW / 2}
                    y={y(d.today)}
                    width={barW}
                    height={Math.max(0, pad.top + innerH - y(d.today))}
                    rx={4}
                    fill={isNow ? `url(#now-${gid})` : `url(#bar-${gid})`}
                    opacity={shown !== null && shown !== i ? 0.35 : 1}
                  />
                  {(i % 2 === 0 || isNow) && d.hour <= currentHour + 1 ? (
                    <text
                      x={x(i)}
                      y={height - 8}
                      textAnchor="middle"
                      className={cn(
                        'text-[10px] tabular-nums',
                        isNow
                          ? 'fill-accent-text font-semibold'
                          : 'fill-fg-subtle',
                      )}
                    >
                      {isNow ? t('now') : pad2(d.hour)}
                    </text>
                  ) : null}
                  <rect
                    x={x(i) - band / 2}
                    y={pad.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setActive(i)}
                  />
                </g>
              )
            })}
            {data.length > 1 ? (
              <path
                d={`${line} L${x(data.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`}
                fill={`url(#area-${gid})`}
                pointerEvents="none"
              />
            ) : null}
            <path
              d={line}
              fill="none"
              stroke="var(--chart-2)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              pointerEvents="none"
            />
            {data[peak] && data[peak].today > 0 ? (
              <g pointerEvents="none">
                <text
                  x={x(peak)}
                  y={y(data[peak].today) - 7}
                  textAnchor="middle"
                  className="fill-fg-muted text-[10px] font-semibold"
                >
                  {t('peak', { hour: pad2(data[peak].hour) })}
                </text>
              </g>
            ) : null}
            {hovered ? (
              <line
                x1={x(shown!)}
                x2={x(shown!)}
                y1={pad.top}
                y2={pad.top + innerH}
                stroke="var(--line-strong)"
                pointerEvents="none"
              />
            ) : null}
          </svg>
        ) : null}
        {hovered ? (
          <div
            className="pointer-events-none absolute top-1 z-10"
            style={{
              left: Math.min(
                width - 180,
                Math.max(0, x(shown!) + (shown! > data.length / 2 ? -190 : 14)),
              ),
            }}
            aria-live="polite"
          >
            <TooltipBox
              title={t('hourLabel', { hour: pad2(hovered.hour) })}
              rows={[
                {
                  key: 'today',
                  label: t('today'),
                  value: f.number(hovered.today),
                  color: 'var(--chart-1)',
                  shape: 'rect',
                },
                {
                  key: 'yesterday',
                  label: t('yesterday'),
                  value: f.number(hovered.yesterday),
                  color: 'var(--chart-2)',
                  shape: 'line',
                  muted: true,
                },
              ]}
            />
          </div>
        ) : null}
        <table className="sr-only">
          <caption>{t('hourly')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('hourLabel', { hour: '' })}</th>
              <th scope="col">{t('today')}</th>
              <th scope="col">{t('yesterday')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.hour}>
                <th scope="row">{t('hourLabel', { hour: pad2(d.hour) })}</th>
                <td>{d.today}</td>
                <td>{d.yesterday}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
