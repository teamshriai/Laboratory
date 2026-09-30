import { TrendingUpIcon } from 'lucide-react'
import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { formatRange } from '@/domain/reference-ranges'
import type { TrendSeries } from '@/services/lab-api'
import { ChartTable, TooltipBox } from '@/components/charts/chart-kit'
import {
  ACTIVE_DOT,
  AXIS_PROPS,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_CURSOR,
  SERIES,
  activeRow,
} from '@/components/charts/theme'
import { ResultFlag } from '@/components/lab/result'
import { Card, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { ViewToggle, type ChartView } from '@/components/charts/chart-kit'

type Point = TrendSeries['points'][number]

export function TrendCard({ trends }: { trends: TrendSeries[] }) {
  const t = useT('patients')
  const f = useFormat()
  const [picked, setPicked] = useState(trends[0]?.analyteId ?? '')
  const [view, setView] = useState<ChartView>('chart')
  const series = trends.find((s) => s.analyteId === picked) ?? trends[0]
  if (!series)
    return (
      <Card>
        <CardHeader icon={<TrendingUpIcon />} tone="blue" title={t('trends')} />
        <EmptyState compact icon={<TrendingUpIcon />} title={t('noTrends')} />
      </Card>
    )
  const values = series.points.map((p) => p.value)
  const lo = Math.min(...values, series.range?.low ?? Infinity)
  const hi = Math.max(...values, series.range?.high ?? -Infinity)
  const { domain, ticks } = niceScale(lo, hi)
  const range = formatRange(series.range)
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        icon={<TrendingUpIcon />}
        tone="blue"
        title={t('trends')}
        action={
          <>
            <Select
              size="sm"
              className="w-48"
              aria-label={t('analyte')}
              value={series.analyteId}
              onValueChange={setPicked}
              options={trends.map((s) => ({
                value: s.analyteId,
                label: s.name,
              }))}
            />
            <ViewToggle value={view} onValueChange={setView} />
          </>
        }
      />
      <div className="px-5 pb-4">
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-chart-3" />
            {series.name}
            {series.unit ? ` (${series.unit})` : ''}
          </span>
          {range ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-success-soft ring-1 ring-success/30" />
              {t('normalRange')} {range}
            </span>
          ) : null}
        </div>
        {view === 'chart' ? (
          <figure
            className="m-0 h-56"
            aria-label={`${series.name}: ${values.join(', ')}`}
          >
            <ResponsiveContainer>
              <LineChart data={series.points} margin={CHART_MARGIN}>
                <CartesianGrid {...GRID_PROPS} />
                {series.range &&
                (series.range.low !== null || series.range.high !== null) ? (
                  <ReferenceArea
                    y1={series.range.low ?? domain[0]}
                    y2={series.range.high ?? domain[1]}
                    fill="var(--success)"
                    fillOpacity={0.09}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                ) : null}
                <XAxis
                  dataKey="at"
                  {...AXIS_PROPS}
                  tickFormatter={(v: number) => f.dateShort(v)}
                  minTickGap={24}
                />
                <YAxis
                  {...AXIS_PROPS}
                  width={40}
                  domain={domain}
                  ticks={ticks}
                  tickFormatter={(v: number) => f.decimal(v)}
                />
                <Tooltip
                  cursor={LINE_CURSOR}
                  content={(props) => {
                    const row = activeRow<Point>(props)
                    if (!row) return null
                    return (
                      <TooltipBox
                        title={f.dateTime(row.at)}
                        rows={[
                          {
                            key: 'v',
                            label: series.name,
                            value: `${f.number(row.value)} ${series.unit}`,
                            color: SERIES[3].color,
                          },
                        ]}
                      >
                        <ResultFlag flag={row.flag} className="mt-1" />
                      </TooltipBox>
                    )
                  }}
                />
                <Line
                  dataKey="value"
                  type="monotone"
                  stroke={SERIES[3].color}
                  strokeWidth={2}
                  dot={(p: {
                    cx?: number
                    cy?: number
                    index?: number
                    payload?: Point
                  }) => {
                    const flagged =
                      p.payload?.flag && p.payload.flag !== 'NORMAL'
                    return (
                      <circle
                        key={p.index}
                        cx={p.cx}
                        cy={p.cy}
                        r={4}
                        fill={flagged ? 'var(--warning)' : SERIES[3].color}
                        stroke="var(--surface)"
                        strokeWidth={2}
                      />
                    )
                  }}
                  activeDot={ACTIVE_DOT}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </figure>
        ) : (
          <ChartTable
            caption={series.name}
            height={224}
            columns={[
              { key: 'date', header: t('colDate') },
              { key: 'value', header: t('colResult'), align: 'right' },
              { key: 'flag', header: t('colFlag') },
            ]}
            rows={series.points.map((p) => ({
              id: String(p.at),
              cells: {
                date: f.dateTime(p.at),
                value: `${f.number(p.value)} ${series.unit}`,
                flag: <ResultFlag flag={p.flag} variant="short" />,
              },
            }))}
          />
        )}
      </div>
    </Card>
  )
}

/** Round axis bounds to a 1-2-5 step so ticks read as whole clinical values. */
function niceScale(lo: number, hi: number) {
  const span = hi - lo || Math.abs(hi) || 1
  const raw = (span * 1.3) / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag
  const min = Math.max(0, Math.floor((lo - span * 0.15) / step) * step)
  const max = Math.ceil((hi + span * 0.15) / step) * step
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step)
    ticks.push(Number(v.toFixed(6)))
  return { domain: [min, max] as [number, number], ticks }
}
