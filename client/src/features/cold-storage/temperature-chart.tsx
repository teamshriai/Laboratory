import { ThermometerIcon } from 'lucide-react'
import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DotItemDotProps } from 'recharts'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { ColdUnitRow } from '@/services/lab-api'
import {
  AXIS_PROPS,
  GRID_PROPS,
  LINE_CURSOR,
  SERIES,
  activeRow,
} from '@/components/charts/theme'
import {
  ChartFrame,
  ChartLegend,
  ChartTable,
  TooltipBox,
  ViewToggle,
  type ChartView,
} from '@/components/charts/chart-kit'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { RangeBadge } from './cold-status'
import { useTemperature } from './cold-utils'

const CHART_HEIGHT = 260
const LINE_COLOR = SERIES[1].color
const BAND_COLOR = 'var(--success)'
const EXCURSION_COLOR = 'var(--danger)'

type Reading = ColdUnitRow['readings'][number]

/** In range: a small dot; out of range: a larger diamond in the critical hue. */
function ReadingMarker({
  cx,
  cy,
  outOfRange,
  active,
}: {
  cx: number
  cy: number
  outOfRange: boolean
  active?: boolean
}) {
  const s = active ? 1.35 : 1
  if (outOfRange)
    return (
      <path
        pointerEvents="none"
        d={`M${cx},${cy - 6 * s} L${cx + 6 * s},${cy} L${cx},${cy + 6 * s} L${cx - 6 * s},${cy} Z`}
        fill={EXCURSION_COLOR}
        stroke="var(--surface)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    )
  return (
    <circle
      pointerEvents="none"
      cx={cx}
      cy={cy}
      r={active ? 5 : 3.5}
      fill={LINE_COLOR}
      stroke="var(--surface)"
      strokeWidth={active ? 2 : 1.5}
    />
  )
}

/** Fourteen days of readings against the unit's allowed band. */
export function TemperatureChart({ unit }: { unit: ColdUnitRow }) {
  const t = useT('coldStorage')
  const f = useFormat()
  const temp = useTemperature()
  const [view, setView] = useState<ChartView>('chart')
  const range = temp.range(unit.min, unit.max)
  const label = t('chartLabel', { name: unit.name, range })
  const values = unit.readings.map((r) => r.value)
  const lo = Math.min(unit.min, ...values)
  const hi = Math.max(unit.max, ...values)
  const pad = Math.max((hi - lo) * 0.2, 1)
  const domain: [number, number] = [Math.floor(lo - pad), Math.ceil(hi + pad)]

  const renderDot = (props: DotItemDotProps) => {
    const p = props.payload as Reading
    if (props.cx === undefined || props.cy === undefined)
      return <g key={`dot-${props.index}`} />
    return (
      <ReadingMarker
        key={`dot-${props.index}`}
        cx={props.cx}
        cy={props.cy}
        outOfRange={p.outOfRange}
      />
    )
  }

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        icon={<ThermometerIcon />}
        tone="sky"
        titleAs="h3"
        title={t('chartTitle')}
        description={t('chartDescription', { range })}
        action={<ViewToggle value={view} onValueChange={setView} />}
      />
      <CardBody className="grid gap-3 pt-0">
        {view === 'chart' ? (
          <>
            <ChartFrame height={CHART_HEIGHT} label={label}>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <LineChart
                  data={unit.readings}
                  margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis
                    dataKey="at"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 10, right: 10 }}
                    tickFormatter={(v: number) => f.dateShort(v)}
                    minTickGap={28}
                    {...AXIS_PROPS}
                  />
                  <YAxis
                    type="number"
                    domain={domain}
                    tickFormatter={(v: number) => temp.number(v)}
                    width={40}
                    allowDecimals={false}
                    {...AXIS_PROPS}
                  />
                  <ReferenceArea
                    y1={unit.min}
                    y2={unit.max}
                    fill={BAND_COLOR}
                    fillOpacity={0.1}
                    stroke="none"
                    ifOverflow="extendDomain"
                  />
                  {(
                    [
                      ['min', unit.min],
                      ['max', unit.max],
                    ] as const
                  ).map(([key, y]) => (
                    <ReferenceLine
                      key={key}
                      y={y}
                      stroke="var(--success-text)"
                      strokeOpacity={0.55}
                      strokeDasharray="4 4"
                      label={{
                        value:
                          key === 'min'
                            ? t('minLine', { value: temp.temp(y) })
                            : t('maxLine', { value: temp.temp(y) }),
                        // Inside the plot, so a phone keeps its width.
                        position:
                          key === 'min'
                            ? 'insideBottomRight'
                            : 'insideTopRight',
                        fill: 'var(--fg-subtle)',
                        fontSize: 10,
                      }}
                    />
                  ))}
                  <Tooltip
                    cursor={LINE_CURSOR}
                    isAnimationActive={false}
                    content={(props) => {
                      const p = activeRow<Reading>(props)
                      if (!p) return null
                      return (
                        <TooltipBox
                          title={f.dateTime(p.at)}
                          rows={[
                            {
                              key: 'value',
                              label: t('colValue'),
                              value: temp.temp(p.value),
                            },
                            {
                              key: 'by',
                              label: t('colBy'),
                              value: p.byName,
                            },
                          ]}
                        >
                          <div className="mt-2 grid gap-1.5 border-t border-line pt-2">
                            <RangeBadge outOfRange={p.outOfRange} />
                            {p.action ? (
                              <p className="max-w-64 text-2xs whitespace-normal text-fg-muted">
                                <span className="font-semibold text-fg">
                                  {t('colAction')}:
                                </span>{' '}
                                {p.action}
                              </p>
                            ) : null}
                          </div>
                        </TooltipBox>
                      )
                    }}
                  />
                  <Line
                    dataKey="value"
                    type="linear"
                    stroke={LINE_COLOR}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    dot={renderDot}
                    activeDot={(props) => {
                      const p = props.payload as Reading
                      if (props.cx === undefined || props.cy === undefined)
                        return null
                      return (
                        <ReadingMarker
                          cx={props.cx}
                          cy={props.cy}
                          outOfRange={p.outOfRange}
                          active
                        />
                      )
                    }}
                    animationDuration={500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>
            <ChartLegend
              items={[
                {
                  key: 'reading',
                  label: t('legendReading'),
                  color: LINE_COLOR,
                  shape: 'line',
                },
                {
                  key: 'band',
                  label: `${t('legendBand')} (${range})`,
                  color: 'color-mix(in oklab, var(--success) 30%, transparent)',
                  shape: 'rect',
                },
                {
                  key: 'excursion',
                  label: t('legendExcursion'),
                  color: EXCURSION_COLOR,
                  shape: 'diamond',
                },
              ]}
            />
          </>
        ) : (
          <ChartTable
            caption={label}
            height={CHART_HEIGHT + 40}
            columns={[
              { key: 'time', header: t('colTime') },
              { key: 'value', header: t('colValue'), align: 'right' },
              { key: 'status', header: t('colStatus') },
              { key: 'by', header: t('colBy') },
              { key: 'action', header: t('colAction') },
            ]}
            rows={unit.readings.toReversed().map((r) => ({
              id: r.id,
              cells: {
                time: f.dateTime(r.at),
                value: temp.temp(r.value),
                status: <RangeBadge outOfRange={r.outOfRange} />,
                by: r.byName,
                action: r.action ?? '-',
              },
            }))}
          />
        )}
      </CardBody>
    </Card>
  )
}
