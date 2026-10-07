import { ClockAlertIcon, TimerIcon, TriangleAlertIcon } from 'lucide-react'
import { MetricStrip } from '@/components/ui/metric-strip'
import { PageHeader } from '@/app/layout/page-header'
import { useState } from 'react'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { DEPARTMENT_TONES } from '@/lib/icon-tones'
import { DEPARTMENT_ICONS } from '@/app/layout/nav-config'
import type { TatTestRow, TatView } from '@/services/lab-api'
import { useLabSettings, useTat } from '@/services/queries'
import { useOpenSample } from '@/features/work-queue/use-open-sample'
import { InsightList } from '@/components/lab/insight-card'
import { PriorityMark } from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { Card, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { IconGlyph } from '@/components/ui/icon-tile'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Segmented } from '@/components/ui/toggles'
import { TatPhasesCard } from './phases'
import { ExportButton } from '@/components/lab/export-button'

const TARGET_PCT = 90
type Risk = TatView['atRisk'][number]

function RiskRow({ r, onOpen }: { r: Risk; onOpen: () => void }) {
  const t = useT('tat')
  const e = useEnum()
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="truncate text-meta font-medium text-fg">
              {r.testName}
            </span>
            <PriorityMark priority={r.priority} />
          </p>
          <p className="truncate text-xs text-fg-muted">
            <span className="font-mono">{r.accessionNo}</span> ·{' '}
            {r.patient.name} · {e('department', r.department)}
          </p>
          <p className="text-2xs text-fg-subtle">
            {t('stage', { stage: e('stage', r.stage) })}
          </p>
        </div>
        <TatIndicator tat={r.tat} compact />
      </button>
    </li>
  )
}

function RiskGroup({
  title,
  hint,
  danger,
  rows,
  empty,
  onOpen,
}: {
  title: string
  hint: string
  danger?: boolean
  rows: Risk[]
  empty: string
  onOpen: (id: string) => void
}) {
  return (
    <section className="border-t border-line first:border-t-0">
      <div className="flex items-baseline gap-3 bg-surface-2/60 px-5 py-2">
        <h3
          className={cn(
            'text-meta font-semibold',
            danger ? 'text-danger-text' : 'text-fg',
          )}
        >
          {title}
          <span className="ml-2 font-normal text-fg-muted tabular-nums">
            {rows.length}
          </span>
        </h3>
        <p className="text-2xs text-fg-subtle">{hint}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-3 text-meta text-fg-subtle">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <RiskRow key={r.itemId} r={r} onOpen={() => onOpen(r.sampleId)} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Splits at-risk items by live TAT ratio against the lab's thresholds. */
function bucketsOf(atRisk: Risk[], warnPct: number, criticalPct: number) {
  const approaching: Risk[] = []
  const breached: Risk[] = []
  const critical: Risk[] = []
  for (const r of atRisk) {
    const ratio = r.tat.ratio
    if (ratio >= criticalPct / 100) critical.push(r)
    else if (ratio >= 1) breached.push(r)
    else if (ratio >= warnPct / 100) approaching.push(r)
  }
  return { approaching, breached, critical }
}

function LiveBuckets({
  view,
  warnPct,
  criticalPct,
}: {
  view: TatView
  warnPct: number
  criticalPct: number
}) {
  const t = useT('tat')
  const openSample = useOpenSample()
  const now = useNow()
  // Recompute ratios on the shared clock so rows move between columns live.
  const live = view.atRisk.map((r) =>
    r.tat.startAt !== null && r.tat.endAt === null && r.tat.targetMs > 0
      ? {
          ...r,
          tat: { ...r.tat, ratio: (now - r.tat.startAt) / r.tat.targetMs },
        }
      : r,
  )
  const b = bucketsOf(live, warnPct, criticalPct)
  return (
    <Card className="mb-5 overflow-hidden">
      <CardHeader
        title={t('atRisk')}
        tone={b.critical.length ? 'rose' : undefined}
        icon={<TriangleAlertIcon />}
      />
      <RiskGroup
        title={t('critical')}
        hint={t('criticalHint', { pct: criticalPct })}
        danger
        rows={b.critical}
        empty={t('noneCritical')}
        onOpen={openSample}
      />
      <RiskGroup
        title={t('breached')}
        hint={t('breachedHint')}
        rows={b.breached}
        empty={t('noneBreached')}
        onOpen={openSample}
      />
      <RiskGroup
        title={t('approaching')}
        hint={t('approachingHint', { pct: warnPct })}
        rows={b.approaching}
        empty={t('noneApproaching')}
        onOpen={openSample}
      />
    </Card>
  )
}

const TAT_INSIGHTS = ['tat-cluster'] as const

export function Component() {
  const t = useT('tat')
  const e = useEnum()
  const f = useFormat()
  const [range, setRange] = useState<'today' | '7d'>('today')
  const { data, isPending, isError, refetch, dataUpdatedAt } = useTat(range)
  const { data: settings } = useLabSettings()
  const warnPct = settings?.tatWarnPct ?? 75
  const criticalPct = settings?.tatCriticalPct ?? 150
  const dur = (min: number | null) =>
    min === null ? '-' : f.duration(min * 60_000)

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  const columns: Column<TatTestRow>[] = [
    {
      id: 'test',
      header: t('colTest'),
      sortValue: (r) => r.testName,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <IconGlyph
            icon={DEPARTMENT_ICONS[r.department]}
            tone={DEPARTMENT_TONES[r.department]}
            size={17}
          />
          <div className="min-w-0">
            <p className="truncate text-meta font-medium text-fg">
              {r.testName}
            </p>
            <p className="text-xs text-fg-muted">
              {e('department', r.department)}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'target',
      header: t('colTarget'),
      align: 'right',
      sortValue: (r) => r.targetHours,
      cell: (r) => (
        <span className="text-meta text-fg-muted tabular-nums">
          {f.hours(r.targetHours)}
        </span>
      ),
    },
    {
      id: 'avg',
      header: t('colAverage'),
      align: 'right',
      sortValue: (r) => r.avgMin ?? -1,
      cell: (r) => (
        <span
          className={cn(
            'text-meta whitespace-nowrap tabular-nums',
            r.avgMin !== null && r.avgMin > r.targetHours * 60
              ? 'font-semibold text-danger-text'
              : 'text-fg',
          )}
        >
          {dur(r.avgMin)}
        </span>
      ),
    },
    {
      id: 'median',
      tabletHidden: true,
      header: t('colMedian'),
      align: 'right',
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg-muted tabular-nums">
          {dur(r.medianMin)}
        </span>
      ),
    },
    {
      id: 'done',
      header: t('colCompleted'),
      align: 'right',
      sortValue: (r) => r.completed,
      cell: (r) => (
        <span className="text-meta tabular-nums">{r.completed}</span>
      ),
    },
    {
      id: 'running',
      tabletHidden: true,
      header: t('colInProgress'),
      align: 'right',
      sortValue: (r) => r.inProgress,
      cell: (r) => (
        <span className="text-meta tabular-nums">{r.inProgress}</span>
      ),
    },
    {
      id: 'delayed',
      header: t('colDelayed'),
      align: 'right',
      sortValue: (r) => r.delayed,
      cell: (r) => (
        <span
          className={cn(
            'text-meta tabular-nums',
            r.delayed ? 'font-semibold text-danger-text' : 'text-fg-subtle',
          )}
        >
          {r.delayed}
        </span>
      ),
    },
    {
      id: 'bullet',
      header: t('colVsTarget'),
      sortValue: (r) => (r.avgMin ?? 0) / (r.targetHours * 60),
      cell: (r) => {
        const ratio = r.avgMin === null ? 0 : r.avgMin / (r.targetHours * 60)
        return (
          <div
            className="relative h-2 w-40 rounded-full bg-surface-3"
            role="img"
            aria-label={`${dur(r.avgMin)} / ${f.hours(r.targetHours)}`}
          >
            <span
              className={cn(
                'absolute inset-y-0 left-0 rounded-full',
                ratio > 1
                  ? 'bg-danger'
                  : ratio > warnPct / 100
                    ? 'bg-warning'
                    : 'bg-chart-1',
              )}
              style={{ width: `${Math.min(100, (ratio / 1.5) * 100)}%` }}
            />
            <span
              aria-hidden
              className="absolute -top-1 -bottom-1 w-0.5 rounded bg-fg-muted"
              style={{ left: `${100 / 1.5}%` }}
            />
          </div>
        )
      },
    },
    {
      id: 'ontime',
      header: t('colOnTime'),
      align: 'right',
      sortValue: (r) => r.onTimePct ?? -1,
      cell: (r) => (
        <span
          className={cn(
            'text-meta tabular-nums',
            r.onTimePct !== null && r.onTimePct < TARGET_PCT
              ? 'font-semibold text-warning-text'
              : 'text-fg',
          )}
        >
          {r.onTimePct === null ? '-' : f.percent(r.onTimePct / 100)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          <>
            {dataUpdatedAt ? (
              <span className="text-xs text-fg-muted">
                {t('updated', { time: f.time(dataUpdatedAt) })}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <ExportButton
              filename={t('exportFile')}
              entity="test"
              disabled={!data?.tests.length}
              rows={() => [
                [
                  t('colTest'),
                  t('exportDepartment'),
                  t('exportTarget'),
                  t('colCompleted'),
                  t('exportAverage'),
                  t('exportMedian'),
                  t('exportOnTime'),
                  t('colInProgress'),
                  t('colDelayed'),
                ],
                ...(data?.tests ?? []).map((r) => [
                  r.testName,
                  e('department', r.department),
                  r.targetHours,
                  r.completed,
                  r.avgMin === null ? '' : Math.round(r.avgMin),
                  r.medianMin === null ? '' : Math.round(r.medianMin),
                  r.onTimePct === null ? '' : Math.round(r.onTimePct),
                  r.inProgress,
                  r.delayed,
                ]),
              ]}
            />
            <Segmented
              value={range}
              onValueChange={setRange}
              aria-label={t('title')}
              options={[
                { value: 'today', label: t('rangeToday') },
                { value: '7d', label: t('range7d') },
              ]}
            />
          </>
        }
      />

      {isPending || !data ? (
        <div className="grid gap-5">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          <MetricStrip
            className="mb-5"
            items={[
              {
                key: 'avg',
                label: t('average'),
                value: dur(data.summary.avgMin),
              },
              {
                key: 'median',
                label: t('median'),
                value: dur(data.summary.medianMin),
              },
              {
                key: 'delayed',
                label: t('delayed'),
                value: data.summary.delayed,
                detail: t('delayedDetail', { now: data.summary.breachedNow }),
                alert: data.summary.breachedNow > 0,
              },
              {
                key: 'compliance',
                label: t('compliance'),
                value:
                  data.summary.onTimePct === null
                    ? '-'
                    : f.percent(data.summary.onTimePct / 100),
                detail: t('target', { value: `${TARGET_PCT}%` }),
                alert:
                  data.summary.onTimePct !== null &&
                  data.summary.onTimePct < TARGET_PCT,
              },
            ]}
          />

          <InsightList kinds={TAT_INSIGHTS} className="mb-5" />

          <LiveBuckets
            key={dataUpdatedAt}
            view={data}
            warnPct={warnPct}
            criticalPct={criticalPct}
          />

          <div className="grid gap-5">
            <TatPhasesCard phases={data.phases} />
            <Card>
              <CardHeader
                icon={<ClockAlertIcon />}
                tone="amber"
                title={t('byDepartment')}
                action={
                  <span className="text-xs text-fg-subtle">
                    {t('targetLine', { value: `${TARGET_PCT}%` })}
                  </span>
                }
              />
              <ul className="grid gap-x-10 gap-y-3 px-5 pb-5 md:grid-cols-2">
                {data.byDepartment
                  .filter((d) => d.onTimePct !== null || d.delayed > 0)
                  .map((d) => (
                    <li key={d.department}>
                      <div className="flex items-center justify-between text-meta">
                        <span className="inline-flex items-center gap-2 text-fg">
                          <IconGlyph
                            icon={DEPARTMENT_ICONS[d.department]}
                            tone={DEPARTMENT_TONES[d.department]}
                            size={16}
                          />
                          {e('department', d.department)}
                        </span>
                        <span className="tabular-nums">
                          <span
                            className={cn(
                              'font-semibold',
                              d.onTimePct !== null && d.onTimePct < TARGET_PCT
                                ? 'text-warning-text'
                                : 'text-fg',
                            )}
                          >
                            {d.onTimePct === null
                              ? t('noCompleted')
                              : f.percent(d.onTimePct / 100)}
                          </span>
                          {d.avgMin !== null ? (
                            <span className="ml-2 text-xs text-fg-subtle">
                              {dur(d.avgMin)}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="relative mt-1.5 h-2 rounded-full bg-surface-3">
                        <span
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-full',
                            d.onTimePct !== null && d.onTimePct < TARGET_PCT
                              ? 'bg-warning'
                              : 'bg-chart-1',
                          )}
                          style={{ width: `${d.onTimePct ?? 0}%` }}
                        />
                        <span
                          aria-hidden
                          className="absolute -top-1 -bottom-1 w-0.5 rounded bg-fg-muted"
                          style={{ left: `${TARGET_PCT}%` }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader
                icon={<TimerIcon />}
                tone="amber"
                title={t('byTest')}
              />
              <DataTable
                caption={t('byTest')}
                columns={columns}
                rows={data.tests}
                getRowId={(r) => r.testId}
                pageSize={12}
                minWidth={860}
                initialSort={{ id: 'delayed', desc: true }}
                empty={
                  <EmptyState
                    icon={<TimerIcon />}
                    tone="amber"
                    compact
                    title={t('emptyTests')}
                    description={t('emptyTestsBody')}
                  />
                }
              />
            </Card>
          </div>
          <p className="mt-3 text-xs text-fg-subtle">{t('lab')}</p>
        </>
      )}
    </>
  )
}
