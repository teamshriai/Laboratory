import { SoftIconTile } from '@/components/ui/icon-tile'
import {
  ArrowRightIcon,
  PinIcon,
  LayoutGridIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { MetricStrip } from '@/components/ui/metric-strip'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { usePreferences } from '@/app/preferences/context'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { DepartmentSummary } from '@/services/lab-api'
import { useDepartments } from '@/services/queries'
import { DEPARTMENT_TONES } from '@/lib/icon-tones'
import { DEPARTMENT_ICONS } from '@/app/layout/nav-config'
import { PageHeader } from '@/app/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { WorkLegend, WorkStrip } from './work-strip'
import { TAT_TARGET_PCT } from './workload'

function Summary({ rows }: { rows: DepartmentSummary[] }) {
  const t = useT('departments')
  const sum = (fn: (d: DepartmentSummary) => number) =>
    rows.reduce((n, d) => n + fn(d), 0)
  return (
    <div className="mb-5 grid gap-3">
      <MetricStrip
        items={[
          {
            key: 'm0',
            label: t('totalTests'),
            value: sum((d) => d.testsToday),
          },
          {
            key: 'm1',
            label: t('totalInProgress'),
            value: sum((d) => d.pending + d.processing + d.awaitingValidation),
          },
          {
            key: 'm2',
            label: t('totalCompleted'),
            value: sum((d) => d.completed),
          },
          { key: 'm3', label: t('totalDelayed'), value: sum((d) => d.delayed) },
          {
            key: 'm4',
            label: t('totalCriticals'),
            value: sum((d) => d.criticalsOpen),
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-xs text-fg-muted">{t('legendLabel')}</p>
        <WorkLegend />
      </div>
    </div>
  )
}

function FooterMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: 'warning' | 'danger'
}) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <p className="truncate text-2xs font-medium text-fg-muted">{label}</p>
      <p
        className={cn(
          'mt-1 truncate text-sm font-semibold tabular-nums',
          tone === 'danger'
            ? 'text-danger-text'
            : tone === 'warning'
              ? 'text-warning-text'
              : 'text-fg',
        )}
      >
        {value}
      </p>
      {detail ? (
        <p className="truncate text-2xs text-fg-subtle">{detail}</p>
      ) : null}
    </div>
  )
}

function DepartmentCard({
  summary: d,
  working,
}: {
  summary: DepartmentSummary
  working: boolean
}) {
  const t = useT('departments')
  const e = useEnum()
  const f = useFormat()
  const name = e('department', d.department)
  const up = d.equipment.total - d.equipment.down
  const belowTarget = d.tatOnTimePct !== null && d.tatOnTimePct < TAT_TARGET_PCT
  return (
    <li>
      <Link
        to={`/laboratory/departments/${d.department}`}
        className="group block h-full rounded-xl focus-visible:outline-offset-4"
      >
        <Card
          className={cn(
            'relative flex h-full flex-col overflow-hidden p-5 transition-colors group-hover:border-line-strong',
            d.criticalsOpen > 0 && 'border-danger/30',
            working && 'border-accent/40',
          )}
        >
          {d.criticalsOpen > 0 ? (
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-0.5 bg-danger"
            />
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <SoftIconTile
                icon={DEPARTMENT_ICONS[d.department]}
                tone={DEPARTMENT_TONES[d.department]}
                size="md"
              />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-fg group-hover:text-accent-text">
                  {name}
                </h2>
                {working ? (
                  <Badge tone="accent" size="sm" className="mt-1">
                    <PinIcon strokeWidth={2.2} />
                    {t('workingBadge')}
                  </Badge>
                ) : null}
              </div>
            </div>
            <ArrowRightIcon
              aria-hidden
              className="mt-1 size-4 shrink-0 text-fg-subtle transition-colors group-hover:text-accent-text"
            />
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <p className="min-w-0">
              <span className="block text-figure font-semibold text-fg tabular-nums">
                {f.number(d.testsToday)}
              </span>
              <span className="mt-1 block text-xs text-fg-muted">
                {t('testsTodayLabel')}
              </span>
            </p>
            <p className="text-right">
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-sm font-semibold tabular-nums',
                  belowTarget ? 'text-warning-text' : 'text-fg',
                )}
              >
                {belowTarget ? (
                  <>
                    <TriangleAlertIcon aria-hidden className="size-3.5" />
                    <span className="sr-only">{t('tatBelowTarget')}</span>
                  </>
                ) : null}
                {d.tatOnTimePct === null
                  ? '-'
                  : f.percent(d.tatOnTimePct / 100)}
              </span>
              <span className="block text-xs text-fg-muted">
                {d.tatOnTimePct === null ? t('noTatYet') : t('tatOnTime')}
              </span>
            </p>
          </div>

          <WorkStrip department={d.department} counts={d} className="mt-4" />

          <div className="mt-auto pt-4">
            <div className="grid grid-cols-3 divide-x divide-line border-t border-line pt-3">
              <FooterMetric
                label={t('delayed')}
                value={f.number(d.delayed)}
                tone={d.delayed > 0 ? 'warning' : undefined}
              />
              <FooterMetric
                label={t('criticals')}
                value={f.number(d.criticalsOpen)}
                tone={d.criticalsOpen > 0 ? 'danger' : undefined}
              />
              <FooterMetric
                label={t('equipment')}
                value={
                  d.equipment.total === 0
                    ? t('noEquipment')
                    : t('equipmentRunning', {
                        up: f.number(up),
                        total: f.number(d.equipment.total),
                      })
                }
                detail={
                  d.equipment.down > 0
                    ? t('equipmentDown', { count: d.equipment.down })
                    : undefined
                }
                tone={d.equipment.down > 0 ? 'danger' : undefined}
              />
            </div>
          </div>
        </Card>
      </Link>
    </li>
  )
}

function CardGridSkeleton() {
  return (
    <div
      role="status"
      aria-busy
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <Card key={i} className="p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <Skeleton className="mt-5 h-7 w-16" />
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (__, j) => (
              <Skeleton key={j} className="h-3" />
            ))}
          </div>
          <Skeleton className="mt-5 h-9 w-full" />
        </Card>
      ))}
    </div>
  )
}

export function Component() {
  const t = useT('departments')
  const { department } = usePreferences()
  const { data, isPending, isError, refetch } = useDepartments()

  return (
    <>
      <PageHeader title={t('title')} />
      {isError && !data ? (
        <Card>
          <ErrorState onRetry={() => void refetch()} />
        </Card>
      ) : isPending || !data ? (
        <>
          <Skeleton className="mb-5 h-20 rounded-xl" />
          <CardGridSkeleton />
        </>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LayoutGridIcon />}
            title={t('emptyTitle')}
            description={t('emptyBody')}
          />
        </Card>
      ) : (
        <>
          <Summary rows={data} />
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.map((d) => (
              <DepartmentCard
                key={d.department}
                summary={d}
                working={department === d.department}
              />
            ))}
          </ul>
        </>
      )}
    </>
  )
}
