import {
  BellRingIcon,
  ChartColumnIcon,
  FlaskConicalIcon,
  PackageIcon,
  LayersIcon,
  UsersRoundIcon,
  CircleXIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ENCOUNTER_TYPES } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { DEPARTMENT_TONES } from '@/lib/icon-tones'
import { DEPARTMENT_ICONS } from '@/app/layout/nav-config'
import type { AnalyticsReport } from '@/services/lab-api'
import {
  ChartCard,
  ChartLegend,
  ChartTable,
  TooltipBox,
} from '@/components/charts/chart-kit'
import {
  ACTIVE_DOT,
  AXIS_PROPS,
  BAR_CURSOR,
  BAR_RADIUS_END,
  BAR_RADIUS_TOP,
  CHART_MARGIN,
  GRID_PROPS,
  SERIES,
  activeRow,
  dayMs,
} from '@/components/charts/theme'
import { Card, CardHeader } from '@/components/ui/card'
import { IconGlyph } from '@/components/ui/icon-tile'
import { focusWhenScrollable } from '@/lib/scroll-focus'

type Report = AnalyticsReport
type Bucket = Report['buckets'][number]

export function WorkloadChart({ report }: { report: Report }) {
  const t = useT('analytics')
  const f = useFormat()
  const hourly = report.bucketUnit === 'hour'
  const label = (k: string) =>
    hourly ? t('hourLabel', { hour: k }) : f.dateShort(dayMs(k))
  const series = [
    {
      key: 'tests',
      label: t('seriesTests'),
      color: SERIES[1].color,
      shape: 'rect' as const,
    },
    {
      key: 'released',
      label: t('seriesReleased'),
      color: SERIES[3].color,
      shape: 'rect' as const,
    },
    {
      key: 'pending',
      label: t('seriesPending'),
      color: SERIES[2].color,
      shape: 'line' as const,
    },
    {
      key: 'rejected',
      label: t('seriesRejected'),
      color: SERIES[4].color,
      shape: 'line' as const,
    },
  ]
  return (
    <ChartCard
      icon={<ChartColumnIcon />}
      tone="blue"
      title={hourly ? t('workloadHourly') : t('workload')}
      legend={<ChartLegend items={series} />}
      chart={
        <figure
          className="m-0 h-[22rem]"
          aria-label={hourly ? t('workloadHourly') : t('workload')}
        >
          <ResponsiveContainer>
            <ComposedChart
              data={report.buckets}
              margin={CHART_MARGIN}
              barGap={2}
              barCategoryGap="22%"
            >
              <CartesianGrid {...GRID_PROPS} />
              <XAxis
                dataKey="key"
                {...AXIS_PROPS}
                tickFormatter={label}
                minTickGap={16}
              />
              <YAxis {...AXIS_PROPS} width={36} allowDecimals={false} />
              <Tooltip
                cursor={BAR_CURSOR}
                content={(p) => {
                  const row = activeRow<Bucket>(p)
                  if (!row) return null
                  return (
                    <TooltipBox
                      title={label(row.key)}
                      rows={series.map((s) => ({
                        key: s.key,
                        label: s.label,
                        value: f.number(row[s.key as keyof Bucket] as number),
                        color: s.color,
                        shape: s.shape,
                      }))}
                    />
                  )
                }}
              />
              <Bar
                dataKey="tests"
                fill={SERIES[1].color}
                radius={BAR_RADIUS_TOP}
                maxBarSize={22}
                isAnimationActive={false}
              />
              <Bar
                dataKey="released"
                fill={SERIES[3].color}
                radius={BAR_RADIUS_TOP}
                maxBarSize={22}
                isAnimationActive={false}
              />
              <Line
                dataKey="pending"
                type="monotone"
                stroke={SERIES[2].color}
                strokeWidth={2}
                dot={false}
                activeDot={ACTIVE_DOT}
                isAnimationActive={false}
              />
              <Line
                dataKey="rejected"
                type="monotone"
                stroke={SERIES[4].color}
                strokeWidth={2}
                dot={false}
                activeDot={ACTIVE_DOT}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </figure>
      }
      table={
        <ChartTable
          caption={t('workload')}
          height={288}
          columns={[
            { key: 'k', header: hourly ? t('colHour') : t('colDay') },
            ...series.map((s) => ({
              key: s.key,
              header: s.label,
              align: 'right' as const,
            })),
          ]}
          rows={report.buckets.map((b) => ({
            id: b.key,
            cells: {
              k: label(b.key),
              tests: f.number(b.tests),
              released: f.number(b.released),
              pending: f.number(b.pending),
              rejected: f.number(b.rejected),
            },
          }))}
        />
      }
    />
  )
}

export function DepartmentCard({ report }: { report: Report }) {
  const t = useT('analytics')
  const e = useEnum()
  const f = useFormat()
  const rows = report.byDepartment
    .filter((d) => d.tests > 0)
    .toSorted((a, b) => b.tests - a.tests)
  const max = Math.max(1, ...rows.map((r) => r.tests))
  const total = rows.reduce((n, r) => n + r.tests, 0) || 1
  const dur = (m: number | null) => (m === null ? '-' : f.duration(m * 60_000))
  return (
    <Card className="min-w-0">
      <CardHeader
        icon={<LayersIcon />}
        tone="indigo"
        title={t('departments')}
      />
      <div
        ref={focusWhenScrollable}
        className="focus-ring scrollbar-thin overflow-x-auto px-5 pb-4"
      >
        <table className="w-full min-w-[480px] text-meta">
          <thead>
            <tr className="text-left text-xs text-fg-muted">
              <th className="py-2 font-medium">{t('colDepartment')}</th>
              <th className="py-2 font-medium">{t('colTests')}</th>
              <th className="py-2 text-right font-medium">{t('colTat')}</th>
              <th className="py-2 text-right font-medium">{t('colOnTime')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.department} className="border-t border-line/70">
                <td className="py-2.5 pr-3">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap text-fg">
                    <IconGlyph
                      icon={DEPARTMENT_ICONS[d.department]}
                      tone={DEPARTMENT_TONES[d.department]}
                      size={17}
                    />
                    {e('department', d.department)}
                  </span>
                </td>
                <td className="w-1/4 py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 rounded-r-sm bg-chart-1"
                      style={{ width: `${(d.tests / max) * 100}%` }}
                    />
                    <span className="text-xs text-fg tabular-nums">
                      {f.number(d.tests)}
                      <span className="ml-1 text-fg-subtle">
                        {f.percent(d.tests / total)}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap text-fg tabular-nums">
                  {dur(d.tatAvgMin)}
                </td>
                <td
                  className={cn(
                    'py-2.5 text-right tabular-nums',
                    d.onTimePct !== null && d.onTimePct < 90
                      ? 'font-semibold text-warning-text'
                      : 'text-fg',
                  )}
                >
                  {d.onTimePct === null ? '-' : f.percent(d.onTimePct / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-fg-subtle">
          {t('departmentTatNote', {
            count: rows.reduce((n, r) => n + r.tatCount, 0),
          })}
        </p>
      </div>
    </Card>
  )
}

export function TopTestsCard({ report }: { report: Report }) {
  const t = useT('analytics')
  const f = useFormat()
  const data = report.topTests
  return (
    <ChartCard
      icon={<FlaskConicalIcon />}
      tone="green"
      title={t('topTests')}
      chart={
        <figure
          className="m-0"
          style={{ height: Math.max(220, data.length * 30) }}
          aria-label={t('topTests')}
        >
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
              barCategoryGap="28%"
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="shortName"
                {...AXIS_PROPS}
                width={92}
              />
              <Tooltip
                cursor={BAR_CURSOR}
                content={(p) => {
                  const row = activeRow<Report['topTests'][number]>(p)
                  if (!row) return null
                  return (
                    <TooltipBox
                      title={row.name}
                      rows={[
                        {
                          key: 'o',
                          label: t('colOrdered'),
                          value: f.number(row.ordered),
                          color: SERIES[5].color,
                          shape: 'rect',
                        },
                        {
                          key: 'a',
                          label: t('colAbnormal'),
                          value:
                            row.abnormalPct === null
                              ? '-'
                              : f.percent(row.abnormalPct / 100),
                          muted: true,
                        },
                      ]}
                    />
                  )
                }}
              />
              <Bar
                dataKey="ordered"
                fill={SERIES[5].color}
                radius={BAR_RADIUS_END}
                maxBarSize={16}
                isAnimationActive={false}
                label={{
                  position: 'right',
                  fill: 'var(--fg-muted)',
                  fontSize: 11,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </figure>
      }
      table={
        <ChartTable
          caption={t('topTests')}
          height={300}
          columns={[
            { key: 'n', header: t('colTest') },
            { key: 'o', header: t('colOrdered'), align: 'right' },
            { key: 'a', header: t('colAbnormal'), align: 'right' },
          ]}
          rows={data.map((d) => ({
            id: d.testId,
            cells: {
              n: d.name,
              o: f.number(d.ordered),
              a: d.abnormalPct === null ? '-' : f.percent(d.abnormalPct / 100),
            },
          }))}
        />
      }
      summary={<p className="text-xs text-fg-subtle">{t('abnormalNote')}</p>}
    />
  )
}

export function RejectionCard({ report }: { report: Report }) {
  const t = useT('analytics')
  const e = useEnum()
  const f = useFormat()
  const total = report.rejectionsByReason.reduce((n, r) => n + r.count, 0)
  const max = Math.max(1, ...report.rejectionsByReason.map((r) => r.count))
  return (
    <Card className="min-w-0">
      <CardHeader icon={<CircleXIcon />} tone="rose" title={t('rejections')} />
      <div className="px-5 pb-5">
        <p className="text-2xl font-semibold text-fg tabular-nums">
          {f.percent(report.totals.rejectionRate / 100)}
          <span className="ml-2 text-sm font-normal text-fg-muted">
            {t('rejectedCount', { count: report.totals.rejected })}{' '}
            {t('ofSamples', { count: f.number(report.totals.samples) })}
          </span>
        </p>
        {total === 0 ? (
          <p className="mt-4 text-meta text-fg-muted">{t('noRejections')}</p>
        ) : (
          <ul className="mt-4 grid gap-2.5">
            {report.rejectionsByReason.map((r) => (
              <li key={r.reason}>
                <div className="flex justify-between text-meta">
                  <span className="text-fg">
                    {e('rejectionReason', r.reason as 'other')}
                  </span>
                  <span className="text-fg-muted tabular-nums">
                    {r.count} · {f.percent(r.count / total)}
                  </span>
                </div>
                <span
                  className="mt-1 block h-1.5 rounded-r-sm bg-chart-4"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

export function CriticalCard({ report }: { report: Report }) {
  const t = useT('analytics')
  const f = useFormat()
  const c = report.criticals
  const items = [
    { key: 'd', label: t('detected'), value: f.number(c.detected) },
    {
      key: 'a',
      label: t('acknowledged'),
      value: `${f.number(c.acknowledged)}${c.detected ? ` · ${f.percent(c.acknowledged / c.detected)}` : ''}`,
    },
    {
      key: 'p',
      label: t('pendingComm'),
      value: f.number(c.pending),
      alert: c.pending > 0,
    },
    {
      key: 'm',
      label: t('medianNotify'),
      value:
        c.medianNotifyMin === null
          ? '-'
          : t('minutes', { count: Math.round(c.medianNotifyMin) }),
    },
  ]
  return (
    <Card className="min-w-0">
      <CardHeader
        icon={<BellRingIcon />}
        tone="rose"
        title={t('criticalTitle')}
      />
      <dl className="grid grid-cols-2 gap-px border-t border-line bg-line">
        {items.map((i) => (
          <div key={i.key} className="bg-surface px-5 py-3.5">
            <dt className="text-xs text-fg-muted">{i.label}</dt>
            <dd
              className={cn(
                'mt-0.5 text-lg font-semibold tabular-nums',
                i.alert ? 'text-danger-text' : 'text-fg',
              )}
            >
              {i.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export function InventoryCard({ report }: { report: Report }) {
  const t = useT('analytics')
  const e = useEnum()
  const f = useFormat()
  const inv = report.inventory
  const max = Math.max(1, ...inv.consumption.map((c) => c.used))
  return (
    <Card className="min-w-0">
      <CardHeader
        icon={<PackageIcon />}
        tone="orange"
        title={t('inventory')}
        action={
          <Link
            to="/inventory"
            className="tap-reach text-xs font-medium text-accent-text hover:underline"
          >
            {t('viewInventory')}
          </Link>
        }
      />
      <div className="grid gap-6 px-5 pb-5 md:grid-cols-2">
        <ul className="grid content-start gap-2.5">
          {inv.consumption
            .toSorted((a, b) => b.used - a.used)
            .map((c) => (
              <li key={c.category}>
                <div className="flex justify-between text-meta">
                  <span className="text-fg">
                    {e('consumableCategory', c.category)}
                  </span>
                  <span className="text-fg-muted tabular-nums">
                    {f.number(c.used)}
                  </span>
                </div>
                <span
                  className="mt-1 block h-1.5 rounded-r-sm bg-chart-2"
                  style={{ width: `${(c.used / max) * 100}%` }}
                />
              </li>
            ))}
        </ul>
        <div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-warning-soft/60 px-3 py-2">
              <p className="text-lg font-semibold text-warning-text tabular-nums">
                {inv.lowStock}
              </p>
              <p className="text-xs text-fg-muted">{t('lowStock')}</p>
            </div>
            <div className="rounded-lg bg-danger-soft/50 px-3 py-2">
              <p className="text-lg font-semibold text-danger-text tabular-nums">
                {inv.expiring}
              </p>
              <p className="text-xs text-fg-muted">{t('expiring')}</p>
            </div>
          </div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
            {t('highUse')}
          </p>
          <ul className="divide-y divide-line">
            {inv.highUse.map((h) => (
              <li
                key={h.id}
                className="flex justify-between gap-3 py-1.5 text-meta"
              >
                <span className="truncate text-fg">{h.name}</span>
                <span className="shrink-0 text-fg-muted tabular-nums">
                  {f.number(h.used)} {h.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

export function EncounterCard({ report }: { report: Report }) {
  const t = useT('analytics')
  const e = useEnum()
  const f = useFormat()
  const total =
    ENCOUNTER_TYPES.reduce((n, k) => n + report.byEncounter[k], 0) || 1
  const colors = [
    SERIES[1].color,
    SERIES[2].color,
    SERIES[3].color,
    SERIES[4].color,
    SERIES[5].color,
  ]
  return (
    <Card className="min-w-0">
      <CardHeader
        icon={<UsersRoundIcon />}
        tone="sky"
        title={t('encounterMix')}
      />
      <div className="px-5 pb-5">
        <div
          className="flex h-3 overflow-hidden rounded-full"
          role="img"
          aria-label={ENCOUNTER_TYPES.map(
            (k) => `${e('encounter', k)} ${report.byEncounter[k]}`,
          ).join(', ')}
        >
          {ENCOUNTER_TYPES.map((k, i) => (
            <span
              key={k}
              className="h-full border-r-2 border-surface last:border-0"
              style={{
                width: `${(report.byEncounter[k] / total) * 100}%`,
                background: colors[i],
              }}
            />
          ))}
        </div>
        <ul className="mt-4 grid gap-2">
          {ENCOUNTER_TYPES.map((k, i) => (
            <li key={k} className="flex items-center justify-between text-meta">
              <span className="inline-flex items-center gap-2 text-fg">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: colors[i] }}
                />
                {e('encounter', k)}
              </span>
              <span className="text-fg-muted tabular-nums">
                {f.number(report.byEncounter[k])} ·{' '}
                {f.percent(report.byEncounter[k] / total)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
