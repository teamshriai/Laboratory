import { ActivityIcon } from 'lucide-react'
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
import { isAbnormal } from '@/domain/flags'
import { formatRange } from '@/domain/reference-ranges'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { TrendSeries } from '@/services/lab-api'
import {
  ChartCard,
  ChartFrame,
  ChartLegend,
  ChartTable,
  TooltipBox,
  type LegendItem,
} from '@/components/charts/chart-kit'
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
import { isCriticalFlag, niceScale } from './nice-scale'

type Point = TrendSeries['points'][number]

const HEIGHT = 150
const LINE = SERIES[1].color

const dotColor = (flag: Point['flag']) =>
  isCriticalFlag(flag)
    ? 'var(--danger)'
    : isAbnormal(flag)
      ? 'var(--warning)'
      : LINE

/**
 * One test parameter over time: a single series, the reference interval as
 * a band when the result carries one, flagged results marked (the tooltip
 * and the table twin name the flag, so it is never colour alone).
 */
export function TrendChart({ series }: { series: TrendSeries }) {
  const t = useT('doctorPortal')
  const f = useFormat()
  const values = series.points.map((p) => p.value)
  const range = series.range
  const hasBand = Boolean(range && (range.low !== null || range.high !== null))
  const lo = Math.min(...values, range?.low ?? Infinity)
  const hi = Math.max(...values, range?.high ?? -Infinity)
  const { domain, ticks } = niceScale(lo, hi)
  const rangeText = formatRange(range)
  const latest = series.points.at(-1)
  const unit = series.unit ? ` ${series.unit}` : ''
  const flagged = series.points.some((p) => isAbnormal(p.flag))
  const critical = series.points.some((p) => isCriticalFlag(p.flag))

  const legend: LegendItem[] = [
    { key: 'line', label: series.name, color: LINE, shape: 'line' },
    ...(hasBand
      ? [
          {
            key: 'band',
            label: t('legendInterval'),
            color: 'color-mix(in oklab, var(--success) 25%, transparent)',
            shape: 'rect' as const,
          },
        ]
      : []),
    ...(flagged && !critical
      ? [
          {
            key: 'abnormal',
            label: t('legendAbnormal'),
            color: 'var(--warning)',
            shape: 'dot' as const,
          },
        ]
      : []),
    ...(critical
      ? [
          {
            key: 'critical',
            label: t('legendCritical'),
            color: 'var(--danger)',
            shape: 'dot' as const,
          },
        ]
      : []),
  ]

  return (
    <ChartCard
      icon={<ActivityIcon />}
      tone={critical ? 'red' : flagged ? 'amber' : 'blue'}
      title={series.name}
      description={
        rangeText
          ? `${t('referenceInterval', { range: rangeText })}${unit}`
          : series.unit || undefined
      }
      summary={
        latest ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-meta text-fg-muted">
              {t('latest', { value: `${f.number(latest.value)}${unit}` })}
            </span>
            <ResultFlag flag={latest.flag} variant="short" />
          </div>
        ) : null
      }
      legend={legend.length > 1 ? <ChartLegend items={legend} /> : null}
      chart={
        <ChartFrame
          height={HEIGHT}
          label={t('trendLabel', {
            name: series.name,
            count: series.points.length,
          })}
        >
          <ResponsiveContainer>
            <LineChart data={series.points} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID_PROPS} />
              {hasBand && range ? (
                <ReferenceArea
                  y1={range.low ?? domain[0]}
                  y2={range.high ?? domain[1]}
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
                          value: `${f.number(row.value)}${unit}`,
                          color: LINE,
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
                stroke={LINE}
                strokeWidth={2}
                dot={(p: {
                  cx?: number
                  cy?: number
                  index?: number
                  payload?: Point
                }) => (
                  <circle
                    key={p.index}
                    cx={p.cx}
                    cy={p.cy}
                    r={isAbnormal(p.payload?.flag) ? 4.5 : 3}
                    fill={dotColor(p.payload?.flag ?? null)}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                )}
                activeDot={ACTIVE_DOT}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      }
      table={
        <ChartTable
          caption={series.name}
          height={HEIGHT + 32}
          columns={[
            { key: 'date', header: t('colDate') },
            { key: 'value', header: t('colResult'), align: 'right' },
            { key: 'flag', header: t('colFlag') },
          ]}
          rows={series.points.toReversed().map((p, i) => ({
            id: `${p.at}-${i}`,
            cells: {
              date: f.dateTime(p.at),
              value: `${f.number(p.value)}${unit}`,
              flag: <ResultFlag flag={p.flag} variant="short" />,
            },
          }))}
        />
      }
    />
  )
}
