import { Change, MetricStrip } from '@/components/ui/metric-strip'
import { PageHeader } from '@/app/layout/page-header'
import { useSearchParams } from 'react-router'
import { DAY, istDay } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type {
  AnalyticsReport,
  AnalyticsRange,
  RangePreset,
} from '@/services/lab-api'
import { useAnalyticsReport } from '@/services/queries'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { Segmented } from '@/components/ui/toggles'
import { dayMs } from '@/components/charts/theme'
import {
  CriticalCard,
  DepartmentCard,
  EncounterCard,
  InventoryCard,
  RejectionCard,
  TopTestsCard,
  WorkloadChart,
} from './analytics-sections'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day as YYYY-MM-DD (2026-00-10 or 2026-02-30 is not). */
const isDayKey = (day: string) => {
  const ms = dayMs(day)
  return DAY_KEY.test(day) && Number.isFinite(ms) && istDay(ms) === day
}

const PRESETS: RangePreset[] = ['today', 'yesterday', '7d', '30d', 'custom']

type Totals = AnalyticsReport['totals']

function Metrics({ report }: { report: AnalyticsReport }) {
  const t = useT('analytics')
  const f = useFormat()
  const p: Partial<Totals> = report.previous ?? {}
  const c = report.totals
  const items = [
    {
      key: 's',
      label: t('samples'),
      value: f.number(c.samples),
      change: <Change current={c.samples} previous={p.samples} />,
    },
    {
      key: 't',
      label: t('tests'),
      value: f.number(c.tests),
      change: <Change current={c.tests} previous={p.tests} />,
    },
    {
      key: 'r',
      label: t('released'),
      value: f.number(c.released),
      change: <Change current={c.released} previous={p.released} />,
    },
    {
      key: 'j',
      label: t('rejectionRate'),
      value: f.percent(c.rejectionRate / 100),
      change: (
        <Change
          current={c.rejectionRate}
          previous={p.rejectionRate}
          higherIsBetter={false}
          mode="points"
        />
      ),
    },
    {
      key: 'a',
      label: t('avgTat'),
      value: c.tatAvgMin === null ? '-' : f.duration(c.tatAvgMin * 60_000),
      change: (
        <Change
          current={c.tatAvgMin}
          previous={p.tatAvgMin}
          higherIsBetter={false}
        />
      ),
    },
    {
      key: 'c',
      label: t('criticals'),
      value: f.number(c.criticals),
    },
    // Revenue only reaches roles allowed to see it (the server sends null).
    ...(c.revenue === null
      ? []
      : [
          {
            key: 'v',
            label: t('revenue'),
            value: f.compactCurrency(c.revenue),
            change: <Change current={c.revenue} previous={p.revenue} />,
          },
        ]),
  ]
  return <MetricStrip className="mb-5" items={items} />
}

export function Component() {
  const t = useT('analytics')
  const f = useFormat()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const preset = (
    PRESETS.includes(params.get('range') as RangePreset)
      ? params.get('range')
      : '7d'
  ) as RangePreset
  const today = istDay(now)
  // A hand-edited or broken bound falls back to its default.
  const dayParam = (key: string, fallback: string) => {
    const value = params.get(key)
    return value !== null && isDayKey(value) && value <= today
      ? value
      : fallback
  }
  const from = dayParam('from', istDay(now - 13 * DAY))
  const to = dayParam('to', today)
  const range: AnalyticsRange =
    preset === 'custom' ? { preset, from, to } : { preset }
  const { data, isPending, isError, refetch, isPlaceholderData } =
    useAnalyticsReport(range)
  const set = (patch: Record<string, string>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) next.set(k, v)
        return next
      },
      { replace: true },
    )

  const label = (p: RangePreset) =>
    ({
      today: t('rangeToday'),
      yesterday: t('rangeYesterday'),
      '7d': t('range7d'),
      '30d': t('range30d'),
      custom: t('rangeCustom'),
    })[p]

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          <>
            {data ? (
              <span className="text-xs text-fg-muted">
                {data.range.from === data.range.to
                  ? t('periodDay', { day: f.date(dayMs(data.range.from)) })
                  : t('period', {
                      from: f.dateShort(dayMs(data.range.from)),
                      to: f.dateShort(dayMs(data.range.to)),
                    })}
                {data.previous
                  ? ` · ${data.range.days === 1 ? t('vsPreviousDay') : t('vsPrevious', { days: data.range.days })}`
                  : ''}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <div className="flex max-w-full flex-wrap items-center gap-2">
              {preset === 'custom' ? (
                <>
                  <label className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                    {t('from')}
                    <Input
                      type="date"
                      value={from}
                      max={to}
                      min={istDay(now - 30 * DAY)}
                      onChange={(ev) =>
                        ev.target.value && set({ from: ev.target.value })
                      }
                      className="h-8 w-36"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                    {t('to')}
                    <Input
                      type="date"
                      value={to}
                      min={from}
                      max={today}
                      onChange={(ev) =>
                        ev.target.value && set({ to: ev.target.value })
                      }
                      className="h-8 w-36"
                    />
                  </label>
                </>
              ) : null}
              <Segmented
                value={preset}
                onValueChange={(v) => set({ range: v })}
                aria-label={t('rangeLabel')}
                options={PRESETS.map((p) => ({ value: p, label: label(p) }))}
              />
            </div>
          </>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isPending || !data ? (
        <div className="grid gap-5">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <div className="grid gap-5 xl:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'transition-opacity',
            isPlaceholderData && 'opacity-60',
          )}
        >
          <Metrics report={data} />
          <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <WorkloadChart report={data} />
            <div className="grid content-start gap-5">
              <CriticalCard report={data} />
              <EncounterCard report={data} />
            </div>
          </div>
          <div className="mb-5 grid gap-5 xl:grid-cols-2">
            <DepartmentCard report={data} />
            <TopTestsCard report={data} />
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <RejectionCard report={data} />
            <InventoryCard report={data} />
          </div>
        </div>
      )}
      <p className="mt-4 max-w-3xl text-xs text-fg-subtle">
        {t('historyNote')}
      </p>
    </>
  )
}
