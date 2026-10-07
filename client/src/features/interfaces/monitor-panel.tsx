import {
  CableIcon,
  CircleCheckIcon,
  ListTreeIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { DEPARTMENT_TONES } from '@/lib/icon-tones'
import { cn } from '@/lib/cn'
import type { InterfaceOverview, InterfaceRow } from '@/services/lab-api'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Meter } from '@/components/ui/misc'
import { CardSkeleton, KpiSkeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { DEPARTMENT_ICONS } from '@/app/layout/nav-config'
import { ConnectionLabel } from './interface-status'
import { interfacesHref, percentOf } from './interfaces'

const linkClass =
  'focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-lg text-meta font-medium text-accent-text underline-offset-2 hover:underline'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-meta text-fg tabular-nums">{children}</dd>
    </div>
  )
}

function AnalyserCard({ row }: { row: InterfaceRow }) {
  const t = useT('interfaces')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const total = row.mapped + row.unmapped.length
  const titleId = `interface-${row.equipmentId}`
  return (
    <Card
      className={cn(
        'flex flex-col p-4 sm:p-5',
        row.errors > 0 && 'border-danger-text/30',
      )}
      role="group"
      aria-labelledby={titleId}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <IconTile
          icon={DEPARTMENT_ICONS[row.department]}
          tone={DEPARTMENT_TONES[row.department]}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-sm font-semibold text-fg">
            {row.name}
          </h2>
          <p className="text-xs text-fg-muted">
            {e('department', row.department)}
          </p>
        </div>
        <ConnectionLabel connection={row.connection} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label={t('protocol')}>
          <span className="font-mono">{row.protocol}</span>
        </Fact>
        <Fact label={t('messagesToday')}>{f.number(row.messagesToday)}</Fact>
        <Fact label={t('errors')}>
          {row.errors > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-danger-text">
              <TriangleAlertIcon className="size-3.5" aria-hidden />
              {t('errorCount', { count: row.errors })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-success-text">
              <CircleCheckIcon className="size-3.5" aria-hidden />
              {t('noErrors')}
            </span>
          )}
        </Fact>
        <Fact label={t('lastMessage')}>
          {row.lastMessageAt ? (
            <span title={f.dateTime(row.lastMessageAt)}>
              {f.relative(row.lastMessageAt, now)}
            </span>
          ) : (
            <span className="text-fg-subtle">{t('noMessagesYet')}</span>
          )}
        </Fact>
      </dl>

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-fg-muted">{t('mapping')}</p>
          <p className="text-meta text-fg tabular-nums">
            {t('mappedOf', { mapped: row.mapped, total })}
          </p>
        </div>
        <Meter
          className="mt-1.5"
          value={row.mapped}
          max={total}
          tone={row.unmapped.length ? 'warning' : 'success'}
        />
        {row.unmapped.length ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-text">
            <TriangleAlertIcon
              className="mt-px size-3.5 shrink-0"
              aria-hidden
            />
            <span>{t('notMapped', { names: row.unmapped.join(', ') })}</span>
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-success-text">
            <CircleCheckIcon className="size-3.5 shrink-0" aria-hidden />
            {t('allMapped')}
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-x-4 pt-2">
        <Link
          to={interfacesHref('mappings', { analyser: row.equipmentId })}
          className={linkClass}
        >
          <ListTreeIcon className="size-4" aria-hidden />
          {t('openMappings')}
        </Link>
        {row.errors > 0 ? (
          <Link
            to={interfacesHref('messages', {
              analyser: row.equipmentId,
              state: 'error',
            })}
            className={linkClass}
          >
            <TriangleAlertIcon className="size-4" aria-hidden />
            {t('openErrors')}
          </Link>
        ) : null}
      </div>
    </Card>
  )
}

/** One card per analyser: connection, traffic, errors and code mapping. */
export function MonitorPanel({
  data,
  isPending,
  isError,
  onRetry,
}: {
  data: InterfaceOverview | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('interfaces')
  const f = useFormat()
  if (isError && !data)
    return (
      <Card>
        <ErrorState onRetry={onRetry} />
      </Card>
    )
  if (isPending || !data)
    return (
      <div className="grid gap-4">
        <KpiSkeleton />
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} lines={5} />
          ))}
        </div>
      </div>
    )
  const rows = data.interfaces
  if (rows.length === 0)
    return (
      <Card>
        <EmptyState
          icon={<CableIcon />}
          tone="teal"
          title={t('monitorEmptyTitle')}
          description={t('monitorEmptyBody')}
        />
      </Card>
    )
  const online = rows.filter((r) => r.connection === 'online').length
  const errors = rows.reduce((n, r) => n + r.errors, 0)
  const mapped = rows.reduce((n, r) => n + r.mapped, 0)
  const total = rows.reduce((n, r) => n + r.mapped + r.unmapped.length, 0)
  return (
    <div className="grid gap-4">
      <MetricStrip
        items={[
          {
            key: 'online',
            label: t('kpiOnline'),
            value: t('countOf', { count: online, total: rows.length }),
            alert: online < rows.length,
          },
          {
            key: 'messages',
            label: t('messagesToday'),
            value: f.number(rows.reduce((n, r) => n + r.messagesToday, 0)),
            href: interfacesHref('messages'),
          },
          {
            key: 'errors',
            label: t('kpiErrors'),
            value: f.number(errors),
            alert: errors > 0,
            href: interfacesHref('messages', { state: 'error' }),
          },
          {
            key: 'mapped',
            label: t('kpiMapped'),
            value: `${percentOf(mapped, total)}%`,
            detail: t('mappedOf', { mapped, total }),
            href: interfacesHref('mappings'),
          },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {rows.map((row) => (
          <AnalyserCard key={row.equipmentId} row={row} />
        ))}
      </div>
    </div>
  )
}
