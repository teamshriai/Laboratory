import {
  BadgeCheckIcon,
  BellRingIcon,
  FileTextIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ScanSearchIcon,
  TruckIcon,
  ZapIcon,
} from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { usePreferences } from '@/app/preferences/context'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import {
  useCriticals,
  useQc,
  useReports,
  useValidationStages,
  useWorkQueueList,
} from '@/services/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { IconGlyph } from '@/components/ui/icon-tile'
import type { IconTone } from '@/lib/icon-tones'

interface Tile {
  key: string
  label: string
  count: number | undefined
  detail?: string
  to: string
  icon: ReactNode
  tone: IconTone
  /** Red when anything is waiting: reserved for the safety obligation. */
  urgent?: boolean
}

/**
 * The dashboard's first row (audit §13): every tile counts work waiting for
 * someone and opens that queue. Each count comes from the same query, with
 * the same filters, as the screen it opens, so the numbers always agree.
 */
export function ActionQueues() {
  const t = useT('dashboard')
  const f = useFormat()
  const now = useNow()
  const id = useId()
  const { department } = usePreferences()
  const scope = department ? { department } : {}
  const queue = useWorkQueueList({ bucket: 'all', q: '', ...scope })
  const stages = useValidationStages(scope)
  const criticals = useCriticals({ status: 'pending', q: '' })
  const ready = useReports({
    status: 'validated',
    date: 'all',
    q: '',
    ...scope,
  })
  const qc = useQc({})

  const stat = queue.data?.rows.filter((r) => r.buckets.includes('stat'))
  const oldestStat = stat?.reduce<number | null>((oldest, r) => {
    const since = r.receivedAt ?? r.collectedAt ?? r.createdAt
    return oldest === null || since < oldest ? since : oldest
  }, null)
  const openQc = qc.data?.events.filter((e) => e.status !== 'resolved')

  const tiles: Tile[] = [
    {
      key: 'critical',
      label: t('queueCritical'),
      count: criticals.data?.counts.pending,
      detail: criticals.data?.counts.overdue
        ? t('queueCriticalOverdue', { count: criticals.data.counts.overdue })
        : undefined,
      to: '/critical-results',
      icon: <BellRingIcon />,
      tone: 'red',
      urgent: true,
    },
    {
      key: 'stat',
      label: t('queueStat'),
      count: queue.data?.counts.stat,
      detail:
        oldestStat !== null && oldestStat !== undefined
          ? t('queueOldest', { age: f.duration(now - oldestStat) })
          : undefined,
      to: '/work-queue?bucket=stat',
      icon: <ZapIcon />,
      tone: 'orange',
    },
    {
      key: 'transit',
      label: t('queueTransit'),
      count: queue.data?.counts['transit-delayed'],
      to: '/work-queue?bucket=transit-delayed',
      icon: <TruckIcon />,
      tone: 'amber',
    },
    {
      key: 'recollect',
      label: t('queueRecollect'),
      count: queue.data?.counts.recollection,
      to: '/work-queue?bucket=recollection',
      icon: <RefreshCwIcon />,
      tone: 'rose',
    },
    {
      key: 'verify',
      label: t('queueVerify'),
      count: stages.data?.review,
      to: '/verification?stage=review',
      icon: <ScanSearchIcon />,
      tone: 'sky',
    },
    {
      key: 'authorise',
      label: t('queueAuthorise'),
      count: stages.data?.authorise,
      to: '/verification?stage=authorise',
      icon: <BadgeCheckIcon />,
      tone: 'violet',
    },
    {
      key: 'release',
      label: t('queueRelease'),
      count: ready.data?.counts.validated,
      to: '/reports?status=validated&date=all',
      icon: <FileTextIcon />,
      tone: 'indigo',
    },
    {
      key: 'qc',
      label: t('queueQc'),
      count: openQc?.length,
      to: '/quality-control',
      icon: <ShieldAlertIcon />,
      tone: 'green',
      urgent: true,
    },
  ]

  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="mb-3 flex min-h-11 items-center text-sm font-semibold text-fg"
      >
        {t('queuesTitle')}
      </h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
        {tiles.map((tile) => (
          <li key={tile.key} className="min-w-0">
            <QueueTile tile={tile} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function QueueTile({ tile }: { tile: Tile }) {
  const t = useT('dashboard')
  const f = useFormat()
  if (tile.count === undefined)
    return <Skeleton className="h-[7.25rem] w-full rounded-xl" />
  const waiting = tile.count > 0
  const alarm = Boolean(tile.urgent && waiting)
  return (
    <Link
      to={tile.to}
      aria-label={`${tile.label}: ${f.number(tile.count)}`}
      className={cn(
        'focus-ring card-hover flex h-full min-h-[7.25rem] flex-col rounded-xl border bg-surface p-3.5 shadow-card',
        alarm ? 'border-danger-text/40 bg-danger-soft' : 'border-border',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'text-xs leading-snug font-medium',
            alarm ? 'text-danger-text' : 'text-fg-muted',
          )}
        >
          {tile.label}
        </span>
        <IconGlyph
          icon={tile.icon}
          tone={alarm ? 'red' : tile.tone}
          size={20}
        />
      </span>
      <span
        className={cn(
          'mt-auto pt-2 text-2xl leading-none font-semibold tracking-tight tabular-nums',
          alarm ? 'text-danger-text' : waiting ? 'text-fg' : 'text-fg-subtle',
        )}
      >
        {f.number(tile.count)}
      </span>
      <span className="mt-1 min-h-4 text-2xs text-fg-subtle">
        {tile.detail ?? (waiting ? '' : t('queueClear'))}
      </span>
    </Link>
  )
}
