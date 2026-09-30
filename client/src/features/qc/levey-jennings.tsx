import { ChartLineIcon } from 'lucide-react'
import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DotItemDotProps } from 'recharts'
import type { QcResult, WestgardRule } from '@/domain/types'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { QcBadge } from '@/components/lab/status'
import { Card, CardBody, CardHeader, Detail } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  AXIS_PROPS,
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
import {
  formatFixed,
  formatZ,
  qcDigits,
  seriesKey,
  type QcPoint,
  type QcSeries,
} from './qc-utils'

const CHART_HEIGHT = 300
const SD_LINES = [3, 2, 1, 0, -1, -2, -3] as const

const MARK_COLOR: Record<QcResult, string> = {
  pass: SERIES[1].color,
  warning: 'var(--warning)',
  fail: 'var(--danger)',
}

function limitStroke(k: number) {
  const abs = Math.abs(k)
  if (abs === 0)
    return { stroke: 'var(--fg-subtle)', dash: undefined, opacity: 0.9 }
  if (abs === 1)
    return { stroke: 'var(--line-strong)', dash: '3 4', opacity: 1 }
  if (abs === 2) return { stroke: 'var(--warning)', dash: '4 4', opacity: 0.75 }
  return { stroke: 'var(--danger)', dash: '4 4', opacity: 0.7 }
}

/** Control value marker: circle for pass, triangle for warning, diamond for failure. */
function QcMarker({
  cx,
  cy,
  result,
  rule,
  active,
}: {
  cx: number
  cy: number
  result: QcResult
  rule?: WestgardRule
  active?: boolean
}) {
  const scale = active ? 1.35 : 1
  const color = MARK_COLOR[result]
  return (
    <g pointerEvents="none">
      {active ? (
        <circle cx={cx} cy={cy} r={10} fill={color} opacity={0.16} />
      ) : null}
      {result === 'pass' ? (
        <circle
          cx={cx}
          cy={cy}
          r={3.75 * scale}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={2}
        />
      ) : result === 'warning' ? (
        <path
          d={`M${cx},${cy - 6 * scale} L${cx + 5.5 * scale},${cy + 4 * scale} L${cx - 5.5 * scale},${cy + 4 * scale} Z`}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ) : (
        <path
          d={`M${cx},${cy - 6 * scale} L${cx + 6 * scale},${cy} L${cx},${cy + 6 * scale} L${cx - 6 * scale},${cy} Z`}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      )}
      {rule && !active ? (
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill="var(--fg-muted)"
        >
          {rule}
        </text>
      ) : null}
    </g>
  )
}

export function LeveyJenningsCard({
  series,
  all,
  onSelect,
  controlLot,
  stale,
}: {
  series: QcSeries
  all: QcSeries[]
  onSelect: (key: string) => void
  controlLot: string | undefined
  stale?: boolean
}) {
  const t = useT('qc')
  const f = useFormat()
  const [view, setView] = useState<ChartView>('chart')
  const digits = qcDigits(series.mean, series.sd)
  const fmt = (n: number) => formatFixed(f.locale, n, digits)
  const sd =
    series.sd > 0 ? series.sd : Math.max(Math.abs(series.mean) * 0.05, 0.01)
  const maxZ = Math.max(3, ...series.points.map((p) => Math.abs(p.z)))
  const span = Math.ceil(maxZ + 0.6)
  const domain: [number, number] = [
    series.mean - span * sd,
    series.mean + span * sd,
  ]
  const level = t('level', { n: series.level.slice(1) })
  const last = series.points.at(-1)
  const violations = series.points.filter((p) => p.result !== 'pass').length

  const analyzers = [
    ...new Map(all.map((s) => [s.equipmentId, s.equipmentName])).entries(),
  ]
  const analytes = [
    ...new Map(
      all
        .filter((s) => s.equipmentId === series.equipmentId)
        .map((s) => [s.analyteId, s.analyteName]),
    ).entries(),
  ]
  const levels = all.filter(
    (s) =>
      s.equipmentId === series.equipmentId && s.analyteId === series.analyteId,
  )
  const pick = (equipmentId: string, analyteId?: string) => {
    const match =
      all.find(
        (s) =>
          s.equipmentId === equipmentId &&
          s.analyteId === analyteId &&
          s.level === series.level,
      ) ??
      all.find(
        (s) =>
          s.equipmentId === equipmentId &&
          (analyteId === undefined || s.analyteId === analyteId),
      )
    if (match) onSelect(seriesKey(match))
  }

  const renderDot = (props: DotItemDotProps) => {
    const p = props.payload as QcPoint
    if (props.cx === undefined || props.cy === undefined)
      return <g key={`dot-${props.index}`} />
    return (
      <QcMarker
        key={`dot-${props.index}`}
        cx={props.cx}
        cy={props.cy}
        result={p.result}
        {...(p.rule ? { rule: p.rule as WestgardRule } : {})}
      />
    )
  }

  return (
    <Card id="qc-chart" className="flex min-w-0 scroll-mt-6 flex-col">
      <CardHeader
        icon={<ChartLineIcon />}
        title={t('chartTitle', { analyte: series.analyteName, level })}
        description={[
          series.equipmentName,
          controlLot ? t('lotValue', { lot: controlLot }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={<ViewToggle value={view} onValueChange={setView} />}
      />
      <CardBody className="grid gap-4 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="sm"
            aria-label={t('analyzer')}
            value={series.equipmentId}
            onValueChange={(v) => pick(v)}
            options={analyzers.map(([value, label]) => ({ value, label }))}
            className="w-52"
          />
          <Select
            size="sm"
            aria-label={t('analyte')}
            value={series.analyteId}
            onValueChange={(v) => pick(series.equipmentId, v)}
            options={analytes.map(([value, label]) => ({ value, label }))}
            className="w-48"
          />
          <Select
            size="sm"
            aria-label={t('controlLevel')}
            value={seriesKey(series)}
            onValueChange={onSelect}
            options={levels.map((s) => ({
              value: seriesKey(s),
              label: t('level', { n: s.level.slice(1) }),
            }))}
            className="w-32"
          />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3 sm:grid-cols-5">
          <Detail label={t('targetMean')}>
            <span className="tabular-nums">
              {fmt(series.mean)}{' '}
              <span className="text-xs font-normal text-fg-muted">
                {series.unit}
              </span>
            </span>
          </Detail>
          <Detail label={t('sd')}>
            <span className="tabular-nums">{fmt(series.sd)}</span>
          </Detail>
          <Detail label={t('cv')}>
            <span className="tabular-nums">
              {series.cv === null ? '-' : f.percent(series.cv / 100)}
            </span>
          </Detail>
          <Detail label={t('runsPlotted')}>
            <span className="tabular-nums">
              {f.number(series.points.length)}
              {violations ? (
                <span className="ml-1.5 text-xs font-normal text-fg-muted">
                  {t('flaggedCount', { count: violations })}
                </span>
              ) : null}
            </span>
          </Detail>
          <Detail label={t('lastRun')}>
            {last ? (
              <span className="flex items-center gap-2">
                <QcBadge result={last.result} size="sm" />
                <span className="truncate text-xs font-normal text-fg-muted">
                  {f.dateShort(last.at)}
                </span>
              </span>
            ) : (
              '-'
            )}
          </Detail>
        </dl>

        {view === 'chart' ? (
          <div className="grid gap-3">
            <ChartFrame
              height={CHART_HEIGHT}
              label={t('chartLabel', {
                analyte: series.analyteName,
                level,
                analyzer: series.equipmentName,
              })}
              stale={stale}
            >
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <LineChart
                  data={series.points}
                  margin={{ top: 16, right: 52, bottom: 0, left: 4 }}
                >
                  <CartesianGrid horizontal={false} vertical={false} />
                  <XAxis
                    dataKey="at"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 14, right: 14 }}
                    tickFormatter={(v: number) => f.dateShort(v)}
                    minTickGap={28}
                    {...AXIS_PROPS}
                  />
                  <YAxis
                    type="number"
                    domain={domain}
                    ticks={SD_LINES.map((k) => series.mean + k * sd)}
                    tickFormatter={(v: number) => fmt(v)}
                    width={52}
                    allowDataOverflow
                    {...AXIS_PROPS}
                  />
                  {SD_LINES.map((k) => {
                    const s = limitStroke(k)
                    return (
                      <ReferenceLine
                        key={k}
                        y={series.mean + k * sd}
                        stroke={s.stroke}
                        strokeOpacity={s.opacity}
                        strokeDasharray={s.dash}
                        label={{
                          value:
                            k === 0
                              ? t('mean')
                              : t('sdLine', {
                                  k: `${k > 0 ? '+' : '-'}${Math.abs(k)}`,
                                }),
                          position: 'right',
                          fill: 'var(--fg-subtle)',
                          fontSize: 10,
                        }}
                      />
                    )
                  })}
                  <Tooltip
                    cursor={LINE_CURSOR}
                    isAnimationActive={false}
                    content={(props) => {
                      const p = activeRow<QcPoint>(props)
                      if (!p) return null
                      return (
                        <TooltipBox
                          title={f.dateTime(p.at)}
                          rows={[
                            {
                              key: 'value',
                              label: t('value'),
                              value: `${fmt(p.value)} ${series.unit}`,
                            },
                            {
                              key: 'z',
                              label: t('zScore'),
                              value: formatZ(p.z),
                            },
                            {
                              key: 'rule',
                              label: t('rule'),
                              value: p.rule ?? t('noRule'),
                            },
                          ]}
                        >
                          <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2">
                            <QcBadge result={p.result} size="sm" />
                            {p.rule ? (
                              <span className="text-2xs text-fg-muted">
                                {t(`rule.${p.rule as WestgardRule}`)}
                              </span>
                            ) : null}
                          </div>
                        </TooltipBox>
                      )
                    }}
                  />
                  <Line
                    dataKey="value"
                    type="linear"
                    stroke={SERIES[1].color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    dot={renderDot}
                    activeDot={(props) => {
                      const p = props.payload as QcPoint
                      if (props.cx === undefined || props.cy === undefined)
                        return null
                      return (
                        <QcMarker
                          cx={props.cx}
                          cy={props.cy}
                          result={p.result}
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
                  key: 'pass',
                  label: t('legendPass'),
                  color: MARK_COLOR.pass,
                  shape: 'dot',
                },
                {
                  key: 'warning',
                  label: t('legendWarning'),
                  color: MARK_COLOR.warning,
                  shape: 'triangle',
                },
                {
                  key: 'fail',
                  label: t('legendFail'),
                  color: MARK_COLOR.fail,
                  shape: 'diamond',
                },
                {
                  key: 'mean',
                  label: t('mean'),
                  color: 'var(--fg-subtle)',
                  shape: 'line',
                },
                {
                  key: 'l2',
                  label: t('legendWarningLimit'),
                  color: 'var(--warning)',
                  shape: 'dash',
                },
                {
                  key: 'l3',
                  label: t('legendRejectLimit'),
                  color: 'var(--danger)',
                  shape: 'dash',
                },
              ]}
            />
          </div>
        ) : (
          <ChartTable
            caption={t('chartLabel', {
              analyte: series.analyteName,
              level,
              analyzer: series.equipmentName,
            })}
            height={CHART_HEIGHT + 28}
            columns={[
              { key: 'time', header: t('colTime') },
              { key: 'value', header: t('value'), align: 'right' },
              { key: 'z', header: t('zScore'), align: 'right' },
              { key: 'rule', header: t('rule') },
              { key: 'result', header: t('colResult') },
            ]}
            rows={series.points.toReversed().map((p) => ({
              id: String(p.at),
              cells: {
                time: f.dateTime(p.at),
                value: `${fmt(p.value)} ${series.unit}`,
                z: formatZ(p.z),
                rule: p.rule ?? '-',
                result: <QcBadge result={p.result} size="sm" />,
              },
            }))}
          />
        )}
      </CardBody>
    </Card>
  )
}
