import {
  CircleCheckIcon,
  GaugeIcon,
  ListChecksIcon,
  PlusIcon,
  CircleXIcon,
} from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type {} from '@/lib/icon-tones'
import type { QcRow } from '@/services/lab-api'
import { useQc } from '@/services/queries'
import { QcBadge } from '@/components/lab/status'
import { GuardedButton } from '@/components/lab/guarded-button'
import { InsightList } from '@/components/lab/insight-card'
import { Card, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { LeveyJenningsCard } from './levey-jennings'
import { QcEventDrawer } from './qc-event-drawer'
import { NotFoundDrawer } from '@/features/shared/not-found-drawer'
import {
  QC_RESULT_FILTERS,
  defaultSeriesKey,
  formatFixed,
  parseResultFilter,
  qcDigits,
  seriesKey,
  sortSeries,
} from './qc-utils'
import { RecordRunDialog, type RecordTarget } from './record-run-dialog'
import { SeriesList } from './series-list'

const QC_INSIGHTS = ['qc-shift'] as const

export function Component() {
  const t = useT('qc')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [recordingState, setRecording] = useState<RecordTarget | 'new' | null>(
    null,
  )
  const [analyzer, setAnalyzer] = useState('all')
  const result = parseResultFilter(params.get('result'))
  const { data, isPending, isError, refetch, dataUpdatedAt } = useQc({})

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  const [eventId, openEvent, closeEvent] = useOverlayParam('event')
  // ?new=1 opens the record-run form (the button and the command palette).
  const [newParam, openNew, closeNew] = useOverlayParam('new')
  const recording =
    recordingState ?? (newParam === '1' ? ('new' as const) : null)
  const closeRecording = () => {
    if (recordingState !== null) setRecording(null)
    else closeNew()
  }

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isPending || !data)
    return (
      <div className="grid gap-5">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Skeleton className="h-[30rem] rounded-xl" />
          <Skeleton className="h-[30rem] rounded-xl" />
        </div>
      </div>
    )

  const series = sortSeries(data.series)
  const activeKey = params.get('series') ?? defaultSeriesKey(series)
  const active = series.find((s) => seriesKey(s) === activeKey) ?? series[0]
  const openEvents = data.events.filter((ev) => ev.status !== 'resolved')
  const event = data.events.find((ev) => ev.id === eventId)
  const lotFor = (key: string) =>
    data.controlLots.find((c) => seriesKey(c) === key)
  const deptOf = new Map(
    data.controlLots.map((c) => [c.equipmentId, c.department]),
  )
  const analyzers = [
    ...new Map(
      data.runs.map((r) => [r.equipmentId, r.equipmentName]),
    ).entries(),
  ]
  const runs = data.runs
    .filter((r) => (analyzer === 'all' ? true : r.equipmentId === analyzer))
    .filter((r) => (result === 'all' ? true : r.result === result))

  const columns: Column<QcRow>[] = [
    {
      id: 'at',
      header: t('colDate'),
      sortValue: (r) => r.at,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {f.dateTime(r.at)}
        </span>
      ),
    },
    {
      id: 'analyzer',
      header: t('colAnalyzer'),
      sortValue: (r) => r.equipmentName,
      cell: (r) => {
        const d = deptOf.get(r.equipmentId)
        return (
          <div className="min-w-0">
            <p className="truncate text-meta text-fg">{r.equipmentName}</p>
            <p className="text-xs text-fg-subtle">
              {d ? e('department', d) : ''}
            </p>
          </div>
        )
      },
    },
    {
      id: 'test',
      header: t('colTest'),
      sortValue: (r) => r.analyteName,
      cell: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-meta font-medium whitespace-nowrap text-fg">
            {r.analyteName}
            <span className="rounded-md bg-surface-3 px-1.5 text-2xs font-semibold text-fg-muted">
              {r.level}
            </span>
          </p>
          <p className="truncate font-mono text-2xs text-fg-subtle">
            {r.controlLot}
          </p>
        </div>
      ),
    },
    {
      id: 'value',
      header: t('colResult'),
      align: 'right',
      cell: (r) => (
        <span
          className={cn(
            'text-meta tabular-nums',
            r.result === 'fail'
              ? 'font-semibold text-danger-text'
              : r.result === 'warning'
                ? 'font-semibold text-warning-text'
                : 'text-fg',
          )}
        >
          {formatFixed(f.locale, r.value, qcDigits(r.mean, r.sd))}
        </span>
      ),
    },
    {
      id: 'mean',
      header: t('colMean'),
      align: 'right',
      cell: (r) => (
        <span className="text-meta text-fg-muted tabular-nums">
          {formatFixed(f.locale, r.mean, qcDigits(r.mean, r.sd))}
        </span>
      ),
    },
    {
      id: 'sd',
      header: t('colSd'),
      align: 'right',
      cell: (r) => (
        <span className="text-meta text-fg-muted tabular-nums">
          {formatFixed(f.locale, r.sd, qcDigits(r.mean, r.sd))}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (r) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <QcBadge result={r.result} size="sm" />
          {r.rule ? (
            <span className="text-2xs font-semibold text-fg-muted">
              {r.rule}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'by',
      tabletHidden: true,
      header: t('colOperator'),
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {r.byName}
        </span>
      ),
    },
  ]

  const repeatTarget: RecordTarget | undefined = event
    ? {
        equipmentId: event.equipmentId,
        analyteId: event.analyteId,
        level: event.level,
        repeat: true,
      }
    : undefined

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          <>
            <span className="text-xs text-fg-muted">
              {t('updated', { time: f.time(dataUpdatedAt) })}
            </span>
          </>
        }
        actions={
          <>
            <GuardedButton
              permission="qc.record"
              variant="primary"
              onClick={() => openNew('1')}
            >
              <PlusIcon strokeWidth={2.5} />
              {t('recordRun')}
            </GuardedButton>
          </>
        }
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <MetricStrip
          className="self-start"
          items={[
            {
              key: 'runs',
              label: t('runsToday'),
              value: data.summary.runsToday,
            },
            {
              key: 'pass',
              label: t('passed'),
              value: data.summary.passed,
              href: '/quality-control?result=pass',
            },
            {
              key: 'warn',
              label: t('warnings'),
              value: data.summary.warnings,
              href: '/quality-control?result=warning',
            },
            {
              key: 'fail',
              label: t('failed'),
              value: data.summary.failures,
              alert: data.summary.failures > 0,
              href: '/quality-control?result=fail',
            },
            {
              key: 'rate',
              label: t('passRate'),
              value:
                data.summary.passRate30d === null
                  ? '-'
                  : f.percent(data.summary.passRate30d / 100),
            },
          ]}
        />
        <Card
          className={cn(
            'flex flex-col',
            openEvents.length && 'border-danger/35',
          )}
        >
          <CardHeader
            icon={<ListChecksIcon />}
            tone="rose"
            title={t('attention')}
            className="pb-2"
          />
          {openEvents.length === 0 ? (
            <p className="flex items-center gap-2 px-5 pb-4 text-meta text-fg-muted">
              <CircleCheckIcon
                strokeWidth={2.2}
                className="size-4 text-success"
              />
              {t('attentionClear')}
            </p>
          ) : (
            <ul className="grid gap-1 px-3 pb-3">
              {openEvents.map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => openEvent(ev.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                  >
                    <CircleXIcon
                      strokeWidth={2.2}
                      className="size-5 shrink-0 text-danger"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-meta font-medium text-fg">
                        {ev.analyteName} {ev.level} · {ev.equipmentName}
                      </span>
                      <span className="block text-xs text-fg-muted">
                        {t('openedAgo', { time: f.relative(ev.openedAt, now) })}{' '}
                        · {t(`status.${ev.status}`)}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-accent-text">
                      {t('viewEvent')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <InsightList kinds={QC_INSIGHTS} className="mb-5" />

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SeriesList
          series={series}
          activeKey={active ? seriesKey(active) : null}
          onSelect={(k) => setParam('series', k)}
        />
        {active ? (
          <LeveyJenningsCard
            series={active}
            all={series}
            onSelect={(k) => setParam('series', k)}
            controlLot={lotFor(seriesKey(active))?.lotNumber}
          />
        ) : (
          <Card>
            <EmptyState
              icon={<GaugeIcon />}
              tone="indigo"
              title={t('attentionClear')}
              description={t('attentionClearBody')}
            />
          </Card>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 pt-3">
          <h2 className="mr-2 pb-3 text-sm font-semibold text-fg">
            {t('runs')}
          </h2>
          <FilterTabs
            value={result}
            onValueChange={(v) => setParam('result', v === 'all' ? null : v)}
            aria-label={t('colStatus')}
            items={QC_RESULT_FILTERS.map((r) => ({
              value: r,
              label: t(`result.${r}`),
              count:
                r === 'all'
                  ? data.runs.length
                  : data.runs.filter((x) => x.result === r).length,
              ...(r === 'fail' ? { tone: 'danger' as const } : {}),
            }))}
          />
          <Select
            size="sm"
            className="mb-2 ml-auto w-56"
            aria-label={t('colAnalyzer')}
            value={analyzer}
            onValueChange={setAnalyzer}
            options={[
              { value: 'all', label: t('allAnalyzers') },
              ...analyzers.map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <DataTable
          caption={t('runs')}
          columns={columns}
          rows={runs}
          getRowId={(r) => r.id}
          rowLabel={(r) => `${r.analyteName} ${r.level}`}
          onRowClick={(r) => {
            const ev = data.events.find((x) => x.runId === r.id)
            if (ev) openEvent(ev.id)
            else setParam('series', seriesKey(r))
          }}
          pageSize={15}
          minWidth={900}
          rowClassName={(r) => (r.result === 'fail' ? 'row-alert' : undefined)}
          empty={
            <EmptyState
              icon={<GaugeIcon />}
              tone="indigo"
              compact
              title={t('emptyRuns')}
              description={t('emptyRunsBody')}
            />
          }
        />
      </Card>

      {event ? (
        <QcEventDrawer
          event={event}
          onClose={closeEvent}
          onRepeat={() => setRecording(repeatTarget ?? 'new')}
        />
      ) : eventId ? (
        <NotFoundDrawer
          title={t('eventTitle')}
          heading={t('eventNotFound')}
          body={t('eventNotFoundBody')}
          onClose={closeEvent}
        />
      ) : null}
      {recording ? (
        <RecordRunDialog
          lots={data.controlLots}
          series={series}
          initial={
            recording === 'new'
              ? active
                ? {
                    equipmentId: active.equipmentId,
                    analyteId: active.analyteId,
                    level: active.level,
                  }
                : undefined
              : recording
          }
          onClose={closeRecording}
        />
      ) : null}
    </>
  )
}
