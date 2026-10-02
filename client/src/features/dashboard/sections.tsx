import {
  ArrowRightIcon,
  BanIcon,
  BellRingIcon,
  CircleCheckIcon,
  FileTextIcon,
  GaugeIcon,
  PackageIcon,
  TimerIcon,
  TriangleAlertIcon,
  UsersRoundIcon,
  WrenchIcon,
  HistoryIcon,
} from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CRITICAL_NOTIFY_LIMIT_MIN } from '@/domain/types'
import { DAY } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { NAV_TONES } from '@/lib/icon-tones'
import type { DashboardView } from '@/services/lab-api'
import { TAT_TARGET_PCT } from '@/features/departments/workload'
import { ChartLegend } from '@/components/charts/chart-kit'
import { CountdownRing, Ring } from '@/components/charts/micro'
import { KpiCard } from '@/components/lab/kpi-tile'
import { EquipmentBadge, QcBadge, StockBadge } from '@/components/lab/status'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Change } from '@/components/ui/metric-strip'
import { initials } from '@/components/ui/misc'
import { focusWhenScrollable } from '@/lib/scroll-focus'

type View = DashboardView

/** "View all →" text action (design system 10.1). */
export function ViewAll({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-accent-text hover:underline"
    >
      {label}
      <ArrowRightIcon className="size-3.5" aria-hidden />
    </Link>
  )
}

/** A calm "nothing to do" line with an icon, never colour alone. */
function AllClear({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-4 pb-5 text-sm text-fg-muted sm:px-5">
      <CircleCheckIcon
        strokeWidth={2.2}
        className="size-4 shrink-0 text-success-text"
        aria-hidden
      />
      {children}
    </p>
  )
}

function useTrendLabel() {
  const t = useT('dashboard')
  const f = useFormat()
  return (values: number[], format: (v: number) => string = f.number) =>
    values.length > 1
      ? t('trend14', {
          first: format(values[0]!),
          last: format(values.at(-1)!),
        })
      : undefined
}

/* ── 2. Critical values ────────────────────────────────────────────────── */

export function CriticalSection({
  criticals,
}: {
  criticals: View['criticals']
}) {
  const t = useT('dashboard')
  const now = useNow()
  const open = criticals.filter(
    (c) => c.status === 'open' || c.status === 'notified',
  )
  return (
    <Card
      className={cn(
        'flex h-full min-w-0 flex-col',
        open.length > 0 && 'border-danger-text/35',
      )}
    >
      <CardHeader
        icon={<BellRingIcon />}
        tone="red"
        title={t('criticals')}
        description={
          open.length
            ? t('criticalsMeta', { count: open.length })
            : t('target30', {
                minutes: criticals[0]?.limitMin ?? CRITICAL_NOTIFY_LIMIT_MIN,
              })
        }
        action={<ViewAll to="/critical-results" label={t('viewAll')} />}
      />
      {open.length === 0 ? (
        <AllClear>{t('allCommunicated')}</AllClear>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {open.map((c) => {
            const minutes = (now - c.detectedAt) / 60_000
            const overdue = c.overdue
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
              >
                <CountdownRing elapsedMin={minutes} limitMin={c.limitMin} />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm">
                    <Link
                      to={`/patients/${c.patient.id}`}
                      className="inline-block py-0.5 font-semibold text-fg hover:underline"
                    >
                      {c.patient.name}
                    </Link>
                    <span className="text-fg-muted"> · {c.analyteName} </span>
                    <span className="font-semibold text-danger-text tabular-nums">
                      {c.value} {c.unit}
                    </span>
                  </p>
                  <p className="truncate text-xs text-fg-subtle">
                    {c.status === 'open'
                      ? t('statusOpen')
                      : t('statusNotified')}{' '}
                    · {c.doctor.name}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs tabular-nums',
                    overdue
                      ? 'font-semibold text-danger-text'
                      : 'text-fg-muted',
                  )}
                >
                  {overdue ? (
                    <TriangleAlertIcon className="size-3.5" aria-hidden />
                  ) : null}
                  {overdue ? `${t('overdue')} · ` : ''}
                  {t('minutesAgo', { value: Math.round(minutes) })}
                </span>
                <Button
                  asChild
                  size="xs"
                  variant={c.status === 'open' ? 'danger' : 'secondary'}
                >
                  <Link to={`/critical-results?alert=${c.id}`}>
                    {t('record')}
                  </Link>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ── 3. Over TAT ───────────────────────────────────────────────────────── */

export function OverTatSection({ tat }: { tat: View['tat'] }) {
  const t = useT('dashboard')
  const f = useFormat()
  const rows = tat.worst.filter((w) => w.tat.ratio > 1).slice(0, 5)
  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader
        icon={<TimerIcon />}
        tone={NAV_TONES.tat}
        title={t('overTat')}
        description={t('overTatMeta', {
          breached: tat.breached,
          approaching: tat.approaching,
        })}
        action={<ViewAll to="/tat" label={t('viewAll')} />}
      />
      {rows.length === 0 ? (
        <AllClear>{t('noneOverTat')}</AllClear>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {rows.map((w) => {
            const over = Math.min(2, w.tat.ratio)
            return (
              <li key={w.itemId}>
                <Link
                  to={`?sample=${w.sampleId}`}
                  className="focus-ring flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      {w.testName}
                    </p>
                    <p className="truncate text-xs text-fg-subtle">
                      <span className="font-mono">{w.accessionNo}</span> ·{' '}
                      {w.patientName}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-3 sm:block"
                  >
                    <span
                      className="block h-full rounded-full bg-danger"
                      style={{ width: `${(over / 2) * 100}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums">
                    <span className="block font-semibold text-danger-text">
                      {t('overBy', {
                        value: f.duration(w.tat.elapsedMs - w.tat.targetMs),
                      })}
                    </span>
                    <span className="text-fg-subtle">
                      {t('targetValue', { value: f.duration(w.tat.targetMs) })}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ── 4. White KPI cards ────────────────────────────────────────────────── */

export function KpiRow({ data }: { data: View }) {
  const t = useT('dashboard')
  const f = useFormat()
  const trendLabel = useTrendLabel()
  const k = data.kpis
  const openCriticals = k.criticalResults.detail?.value ?? 0
  return (
    <div className="grid h-full grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-5 lg:grid-cols-4">
      <KpiCard
        to="/critical-results"
        tone="red"
        icon={<BellRingIcon />}
        label={t('criticalResults')}
        value={f.number(k.criticalResults.value)}
        alert={openCriticals > 0}
        change={
          <Change
            current={k.criticalResults.value}
            previous={k.criticalResults.yesterday}
            higherIsBetter={false}
          />
        }
        detail={t('openCount', { count: openCriticals })}
        trend={data.trend.criticals}
        trendLabel={trendLabel(data.trend.criticals)}
      />
      <KpiCard
        to="/reports?status=validated"
        tone="green"
        icon={<CircleCheckIcon />}
        label={t('validatedTests')}
        value={f.number(k.validatedTests.value)}
        change={
          <Change
            current={k.validatedTests.value}
            previous={k.validatedTests.yesterday}
            label={t('vsYesterday')}
          />
        }
        trend={data.trend.completed}
        trendLabel={trendLabel(data.trend.completed)}
      />
      <KpiCard
        to="/reception?status=rejected"
        tone="orange"
        icon={<BanIcon />}
        label={t('rejectedSamples')}
        value={f.number(k.rejectedSamples.value)}
        change={
          <Change
            current={k.rejectedSamples.value}
            previous={k.rejectedSamples.yesterday}
            higherIsBetter={false}
          />
        }
        detail={t('recollectDue', {
          count: k.rejectedSamples.detail?.value ?? 0,
        })}
        trend={data.trend.rejected}
        trendLabel={trendLabel(data.trend.rejected)}
      />
      <KpiCard
        to="/reports?status=released"
        tone="indigo"
        icon={<FileTextIcon />}
        label={t('reportsReleased')}
        value={f.number(k.completedReports.value)}
        change={
          <Change
            current={k.completedReports.value}
            previous={k.completedReports.yesterday}
            label={t('vsYesterday')}
          />
        }
        detail={t('inProcessingDetail', {
          count: f.number(k.inProcessing.value),
        })}
      />
    </div>
  )
}

/* ── 7. TAT gauge and by-department bars ───────────────────────────────── */

export function TatPanel({
  tat,
  byDepartment,
}: {
  tat: View['tat']
  byDepartment: View['tatByDepartment']
}) {
  const t = useT('dashboard')
  const e = useEnum()
  const f = useFormat()
  const pct = tat.onTimePct
  const below = pct !== null && pct < TAT_TARGET_PCT
  const rows = byDepartment.toSorted((a, b) => a.onTimePct - b.onTimePct)
  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader
        icon={<GaugeIcon />}
        tone={NAV_TONES.tat}
        title={t('tatPanel')}
        action={<ViewAll to="/tat" label={t('viewAll')} />}
      />
      <div className="flex flex-wrap items-center gap-5 px-4 sm:px-5">
        <Ring
          size={112}
          stroke={10}
          value={pct === null ? null : pct / 100}
          target={TAT_TARGET_PCT / 100}
          tone={below ? 'warning' : 'accent'}
          label={t('tatGaugeLabel', {
            value: pct === null ? '-' : f.percent(pct / 100),
            target: f.percent(TAT_TARGET_PCT / 100),
          })}
        >
          <span>
            <span className="block text-2xl leading-none font-semibold tracking-tight text-fg tabular-nums">
              {pct === null ? '-' : f.percent(pct / 100)}
            </span>
            <span className="mt-1 block text-2xs font-medium text-fg-subtle">
              {t('tatOnTime')}
            </span>
          </span>
        </Ring>
        <dl className="grid min-w-0 flex-1 basis-40 grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-fg-subtle">{t('avgTat')}</dt>
            <dd className="font-semibold text-fg tabular-nums">
              {tat.avgMin === null ? '-' : f.duration(tat.avgMin * 60_000)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">{t('medianTat')}</dt>
            <dd className="font-semibold text-fg tabular-nums">
              {tat.medianMin === null
                ? '-'
                : f.duration(tat.medianMin * 60_000)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">{t('breached')}</dt>
            <dd
              className={cn(
                'font-semibold tabular-nums',
                tat.breached ? 'text-danger-text' : 'text-fg',
              )}
            >
              {f.number(tat.breached)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">{t('approaching')}</dt>
            <dd
              className={cn(
                'font-semibold tabular-nums',
                tat.approaching ? 'text-warning-text' : 'text-fg',
              )}
            >
              {f.number(tat.approaching)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 border-t border-line px-4 pt-3 pb-4 sm:px-5">
        <p className="mb-2 flex items-center justify-between text-xs font-medium text-fg-subtle">
          {t('byDepartment')}
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-0.5 rounded-full bg-fg" />
            {t('targetLine', { value: f.percent(TAT_TARGET_PCT / 100) })}
          </span>
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('noTatYet')}</p>
        ) : (
          <ul className="grid gap-2">
            {rows.map((d) => {
              const low = d.onTimePct < TAT_TARGET_PCT
              return (
                <li
                  key={d.department}
                  className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_3.25rem] items-center gap-2 text-xs"
                  title={`${e('department', d.department)}: ${f.percent(d.onTimePct / 100)}`}
                >
                  <span className="truncate text-fg-muted">
                    {e('department', d.department)}
                  </span>
                  <span
                    aria-hidden
                    className="relative block h-2 rounded-full bg-surface-3"
                  >
                    <span
                      className={cn(
                        'absolute inset-y-0 left-0 rounded-full',
                        low ? 'bg-warning' : 'bg-chart-1',
                      )}
                      style={{ width: `${d.onTimePct}%` }}
                    />
                    <span
                      className="absolute -inset-y-1 w-0.5 rounded-full bg-fg"
                      style={{ left: `${TAT_TARGET_PCT}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center justify-end gap-0.5 font-semibold tabular-nums',
                      low ? 'text-warning-text' : 'text-fg',
                    )}
                  >
                    {low ? (
                      <TriangleAlertIcon
                        className="size-3"
                        aria-label={t('belowTarget')}
                      />
                    ) : null}
                    {f.percent(d.onTimePct / 100)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}

/* ── 8. Department workload ────────────────────────────────────────────── */

export function WorkloadPanel({ workload }: { workload: View['workload'] }) {
  const t = useT('dashboard')
  const e = useEnum()
  const rows = workload.filter(
    (w) => w.pending + w.processing + w.completed > 0,
  )
  const max = Math.max(
    1,
    ...rows.map((w) => w.pending + w.processing + w.completed),
  )
  const series = [
    { key: 'pending', label: t('pending'), color: 'var(--chart-2)' },
    { key: 'processing', label: t('inLab'), color: 'var(--chart-4)' },
    { key: 'completed', label: t('completed'), color: 'var(--chart-1)' },
  ] as const
  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader
        icon={<UsersRoundIcon />}
        tone={NAV_TONES.workQueue}
        title={t('wip')}
        action={
          <ChartLegend
            items={series.map((s) => ({ ...s, shape: 'rect' as const }))}
          />
        }
      />
      <div
        ref={focusWhenScrollable}
        className="focus-ring relative scrollbar-thin overflow-x-auto"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">{t('wip')}</caption>
          <thead>
            <tr className="bg-surface-2 text-left text-xs text-fg-muted">
              <th scope="col" className="py-2 pr-3 pl-4 font-semibold sm:pl-5">
                {t('department')}
              </th>
              <th
                scope="col"
                className="w-1/2 px-3 py-2 font-semibold max-sm:hidden"
              >
                <span className="sr-only">{t('wip')}</span>
              </th>
              {series.map((s, i) => (
                <th
                  key={s.key}
                  scope="col"
                  className={cn(
                    'px-3 py-2 text-right font-semibold',
                    i === series.length - 1 && 'pr-4 sm:pr-5',
                  )}
                >
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => {
              const sum = w.pending + w.processing + w.completed
              return (
                <tr key={w.department} className="border-t border-line">
                  <th
                    scope="row"
                    className="py-2 pr-3 pl-4 text-left font-medium sm:pl-5"
                  >
                    <Link
                      to={`/departments/${w.department}`}
                      className="inline-block py-0.5 text-fg hover:underline"
                    >
                      {e('department', w.department)}
                    </Link>
                  </th>
                  <td className="px-3 py-2 max-sm:hidden">
                    <div
                      className="flex h-2.5 gap-0.5"
                      style={{ width: `${(sum / max) * 100}%` }}
                      aria-hidden
                    >
                      {series.map((s) =>
                        w[s.key] ? (
                          <span
                            key={s.key}
                            title={`${s.label}: ${w[s.key]}`}
                            className="h-full rounded-sm first:rounded-l-sm last:rounded-r-sm"
                            style={{ flex: w[s.key], background: s.color }}
                          />
                        ) : null,
                      )}
                    </div>
                  </td>
                  {series.map((s, i) => (
                    <td
                      key={s.key}
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        s.key === 'completed' ? 'text-fg-muted' : 'text-fg',
                        i === series.length - 1 && 'pr-4 sm:pr-5',
                      )}
                    >
                      {w[s.key]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── 10. Analyzers ─────────────────────────────────────────────────────── */

const QC_DOT = {
  pass: 'bg-success',
  warning: 'bg-warning',
  fail: 'bg-danger',
  none: 'bg-line-strong',
} as const

export function AnalyzersPanel({ data }: { data: View }) {
  const t = useT('dashboard')
  const e = useEnum()
  const up = data.analyzers.filter((a) => a.status === 'operational').length
  const rows = data.analyzers
    .toSorted(
      (a, b) =>
        Number(a.status === 'operational') -
          Number(b.status === 'operational') ||
        b.utilizationPct - a.utilizationPct,
    )
    .slice(0, 7)
  const qc = data.qcToday
  const qcTotal = qc.pass + qc.warning + qc.fail
  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader
        icon={<WrenchIcon />}
        tone={NAV_TONES.equipment}
        title={t('analyzersTitle')}
        description={t('analyzersHeader', {
          up,
          total: data.analyzers.length,
        })}
        action={<ViewAll to="/equipment" label={t('viewAll')} />}
      />
      <div className="px-4 pb-3 sm:px-5">
        <p className="mb-1.5 text-xs text-fg-muted">
          {t('qcSummary', {
            pass: qc.pass,
            warning: qc.warning,
            fail: qc.fail,
          })}
        </p>
        {qcTotal > 0 ? (
          <div aria-hidden className="flex h-2 gap-0.5">
            {(['pass', 'warning', 'fail'] as const).map((k) =>
              qc[k] ? (
                <span
                  key={k}
                  className={cn('h-full rounded-sm', QC_DOT[k])}
                  style={{ flex: qc[k] }}
                />
              ) : null,
            )}
          </div>
        ) : null}
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {rows.map((a) => (
          <li key={a.id}>
            <Link
              to={`/equipment?equipment=${a.id}`}
              className="focus-ring grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:px-5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">
                  {a.name}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                  <span
                    aria-hidden
                    className={cn('size-2 rounded-full', QC_DOT[a.qcToday])}
                  />
                  {a.qcToday === 'none'
                    ? t('noQc')
                    : t('qcShort', { result: e('qcResult', a.qcToday) })}
                </span>
              </span>
              <span
                className="hidden items-center gap-1.5 sm:flex"
                title={t('utilization', { value: a.utilizationPct })}
              >
                <span
                  aria-hidden
                  className="block h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
                >
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      a.utilizationPct > 85 ? 'bg-warning' : 'bg-chart-1',
                    )}
                    style={{ width: `${a.utilizationPct}%` }}
                  />
                </span>
                <span className="w-8 text-right text-2xs text-fg-subtle tabular-nums">
                  {a.utilizationPct}%
                </span>
              </span>
              {a.status !== 'operational' ? (
                <EquipmentBadge status={a.status} size="sm" />
              ) : a.qcToday === 'fail' || a.qcToday === 'warning' ? (
                <QcBadge result={a.qcToday} size="sm" />
              ) : (
                <EquipmentBadge status={a.status} size="sm" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ── 11. Stock ─────────────────────────────────────────────────────────── */

export function StockPanel({ alerts }: { alerts: View['stockAlerts'] }) {
  const t = useT('dashboard')
  const now = useNow()
  const stock = alerts.slice(0, 6)
  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader
        icon={<PackageIcon />}
        tone={NAV_TONES.inventory}
        title={t('stockTitle')}
        action={<ViewAll to="/inventory?tab=expiry" label={t('viewAll')} />}
      />
      {stock.length === 0 ? (
        <AllClear>{t('stockClear')}</AllClear>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {stock.map((s) => {
            const days = s.expiresAt
              ? Math.floor((s.expiresAt - now) / DAY)
              : null
            return (
              <li key={`${s.kind}-${s.id}`}>
                <Link
                  to={s.link}
                  className="focus-ring flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {s.name}
                    </span>
                    <span className="block truncate text-xs text-fg-subtle">
                      {s.detail}
                      {days !== null
                        ? ` · ${days < 0 ? t('expiredAgo') : t('expiresIn', { days })}`
                        : ''}
                    </span>
                  </span>
                  <StockBadge status={s.status} size="sm" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ── 12. Recent activity: the solid timeline panel (design system 9.3) ── */

export function RecentActivity({ activity }: { activity: View['activity'] }) {
  const t = useT('dashboard')
  const ta = useT('activity')
  const f = useFormat()
  const now = useNow()
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      style={{
        backgroundImage:
          'linear-gradient(160deg, var(--tile-blue) 0%, var(--tile-blue) 55%, color-mix(in oklab, var(--tile-blue) 78%, #6a4e9e) 100%)',
      }}
      className="flex h-full min-w-0 flex-col rounded-xl p-4 text-white shadow-card sm:p-5"
    >
      <h2
        id={id}
        className="flex min-h-11 items-center gap-2.5 text-sm font-semibold"
      >
        <span aria-hidden className="duo-on-fill inline-flex">
          <HistoryIcon className="size-[22px]" strokeWidth={1.75} />
        </span>
        {t('activity')}
      </h2>
      <ol className="mt-3 grid gap-x-6 md:grid-cols-2">
        {activity.slice(0, 8).map((a, i, list) => {
          const body = (
            <>
              <span className="flex flex-col items-center self-stretch">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xs font-bold"
                >
                  {initials(a.byName)}
                </span>
                {i < list.length - 1 ? (
                  <span aria-hidden className="w-px flex-1 bg-white/20" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 pb-3">
                <span className="block truncate text-sm font-medium text-white">
                  {ta(a.type as Parameters<typeof ta>[0], a.params)}
                </span>
                <span className="block text-xs text-white/75">
                  {a.byName} · {f.relative(a.at, now)}
                </span>
              </span>
            </>
          )
          return (
            <li key={a.id}>
              {a.link ? (
                <Link
                  to={a.link}
                  className="focus-ring flex gap-3 rounded-lg pt-1 hover:bg-white/5"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex gap-3 pt-1">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
