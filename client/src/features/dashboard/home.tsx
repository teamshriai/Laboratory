import {
  ArrowRightLeftIcon,
  BadgeCheckIcon,
  BedDoubleIcon,
  BellRingIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleIcon,
  ClipboardListIcon,
  ClockAlertIcon,
  ClockIcon,
  FileTextIcon,
  FlaskConicalIcon,
  PenLineIcon,
  PencilLineIcon,
  RefreshCwIcon,
  SyringeIcon,
  TestTubeIcon,
  TriangleAlertIcon,
  ZapIcon,
} from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { usePreferences } from '@/app/preferences/context'
import { istHour, startOfIstDay } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type {
  DashboardView,
  TodayAgendaItem,
  TodaySeverity,
  TodayView,
  WorkQueueRow,
} from '@/services/lab-api'
import { useToday, useWorkQueueList } from '@/services/queries'
import { AgeSex } from '@/components/lab/patient'
import { PriorityMark } from '@/components/lab/status'
import { Avatar } from '@/components/ui/misc'
import { CalendarCard } from './calendar-card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'

const CARD = 'rounded-2xl border border-border/70 bg-surface shadow-card'

/* ── Stat tiles ─────────────────────────────────────────────────────────── */

type Hue = 'blue' | 'orange' | 'teal' | 'violet' | 'pink' | 'red'
const HUE: Record<Hue, { wash: string; solid: string; text: string }> = {
  blue: {
    wash: 'bg-stat-blue',
    solid: 'bg-stat-blue-solid',
    text: 'text-stat-blue-text',
  },
  orange: {
    wash: 'bg-stat-orange',
    solid: 'bg-stat-orange-solid',
    text: 'text-stat-orange-text',
  },
  teal: {
    wash: 'bg-stat-teal',
    solid: 'bg-stat-teal-solid',
    text: 'text-stat-teal-text',
  },
  violet: {
    wash: 'bg-stat-violet',
    solid: 'bg-stat-violet-solid',
    text: 'text-stat-violet-text',
  },
  pink: {
    wash: 'bg-stat-pink',
    solid: 'bg-stat-pink-solid',
    text: 'text-stat-pink-text',
  },
  red: {
    wash: 'bg-stat-red',
    solid: 'bg-stat-red-solid',
    text: 'text-stat-red-text',
  },
}

function StatTile({
  to,
  hue,
  icon,
  value,
  label,
  sub,
}: {
  to: string
  hue: Hue
  icon: ReactNode
  value: number
  label: string
  sub: string
}) {
  const f = useFormat()
  const look = HUE[hue]
  const quiet = value === 0
  return (
    <Link
      to={to}
      aria-label={`${label}: ${f.number(value)}. ${sub}`}
      className={cn(
        'focus-ring card-hover flex min-w-0 flex-col items-start gap-2 rounded-2xl p-3 @lg:flex-row @lg:items-center @lg:gap-3',
        look.wash,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-xl @lg:size-9 [&>svg]:size-4 @lg:[&>svg]:size-[18px]',
          quiet ? 'bg-surface/70 text-fg-subtle' : `${look.solid} text-white`,
        )}
      >
        {icon}
      </span>
      <span className="w-full min-w-0">
        <span
          className={cn(
            'block text-lg leading-none font-semibold tracking-tight tabular-nums',
            quiet ? 'text-fg-muted' : look.text,
          )}
        >
          {f.number(value)}
        </span>
        <span className="mt-1 block truncate text-sm leading-tight font-medium text-fg">
          {label}
        </span>
        <span className="block truncate text-2xs text-fg-muted">{sub}</span>
      </span>
    </Link>
  )
}

export function StatTiles({ today }: { today: TodayView }) {
  const t = useT('today')
  const f = useFormat()
  const now = useNow()
  const todo = (key: TodayView['todo'][number]['key']) =>
    today.todo.find((x) => x.key === key)!
  const stat = today.priorities.find((p) => p.key === 'stat')
  const age = (at: number | undefined) =>
    at === undefined
      ? t('tile.nothing')
      : t('oldest', { age: f.duration(now - at) })
  return (
    <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @5xl:grid-cols-5">
      <StatTile
        to="/orders"
        hue="blue"
        icon={<ClipboardListIcon />}
        value={today.summary.ordersToday}
        label={t('tile.orders')}
        sub={t('tile.ordersSub', { count: today.summary.collected })}
      />
      <StatTile
        to="/reception?status=collected"
        hue="orange"
        icon={<TestTubeIcon />}
        value={todo('reception').count}
        label={t('tile.reception')}
        sub={age(todo('reception').oldestAt)}
      />
      <StatTile
        to="/worklists"
        hue="teal"
        icon={<PencilLineIcon />}
        value={today.summary.inProgress}
        label={t('tile.progress')}
        sub={t('dueToday', { count: todo('entry').dueToday })}
      />
      <StatTile
        to="/verification?stage=review"
        hue="violet"
        icon={<BadgeCheckIcon />}
        value={todo('verify').count}
        label={t('tile.verify')}
        sub={t('tile.verifySub', { count: todo('authorise').count })}
      />
      <StatTile
        to="/work-queue?bucket=stat"
        hue="pink"
        icon={<ZapIcon />}
        value={stat?.count ?? 0}
        label={t('tile.stat')}
        sub={age(stat?.oldestAt)}
      />
    </div>
  )
}

/* ── Today: hourly strip and agenda timeline ─────────────────────────── */

const ROUTINE_ICON: Record<string, ReactNode> = {
  wardRound: <BedDoubleIcon />,
  qcMorning: <FlaskConicalIcon />,
  opdCollection: <SyringeIcon />,
  signOut: <PenLineIcon />,
  eveningRound: <BedDoubleIcon />,
  handover: <ArrowRightLeftIcon />,
  critical: <BellRingIcon />,
  stat: <ZapIcon />,
  urgent: <ClockAlertIcon />,
}

const FIRST_HOUR = 7
const LAST_HOUR = 19

function HourStrip({ hourly }: { hourly: DashboardView['hourly'] }) {
  const t = useT('today')
  const now = useNow()
  const hourNow = istHour(now)
  const hours = hourly.filter(
    (h) => h.hour >= FIRST_HOUR && h.hour <= LAST_HOUR,
  )
  const max = Math.max(
    1,
    ...hours.map((h) => h.today),
    ...hours.map((h) => h.yesterday),
  )
  const total = hourly.reduce((n, h) => n + h.today, 0)
  const level = (n: number) =>
    n === 0
      ? 'bg-surface-3'
      : n / max < 0.34
        ? 'bg-chart-1/30'
        : n / max < 0.67
          ? 'bg-chart-1/60'
          : 'bg-chart-1'
  const minuteShare =
    (now - startOfIstDay(now) - hourNow * 3_600_000) / 3_600_000
  return (
    <figure className="m-0 rounded-xl bg-surface-2 px-3 py-2.5">
      <figcaption className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
        <span>{t('hourlyCaption')}</span>
        <span className="font-semibold text-fg">
          {t('hourlySummary', { count: total })}
        </span>
      </figcaption>
      <ol
        className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1"
        aria-label={t('hourlyCaption')}
      >
        {hours.map((h) => {
          const label = `${String(h.hour).padStart(2, '0')}:00`
          const current = h.hour === hourNow
          return (
            <li
              key={h.hour}
              title={t('hourCell', { hour: label, count: h.today })}
              className={cn(
                'relative h-6 rounded-md',
                h.hour > hourNow ? 'bg-surface-3/60' : level(h.today),
                current &&
                  'ring-2 ring-accent ring-offset-1 ring-offset-surface-2',
              )}
            >
              <span className="sr-only">
                {t('hourCell', { hour: label, count: h.today })}
              </span>
              {current ? (
                <span
                  aria-hidden
                  className="absolute -top-1 -bottom-1 w-0.5 rounded bg-danger"
                  style={{ left: `${Math.round(minuteShare * 100)}%` }}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
      <div
        aria-hidden
        className="mt-1 grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1 text-2xs text-fg-subtle tabular-nums"
      >
        {hours.map((h) => (
          <span key={h.hour}>
            {h.hour % 2 === 1 ? String(h.hour).padStart(2, '0') : ''}
          </span>
        ))}
      </div>
    </figure>
  )
}

export function TodayCard({
  today,
  dashboard,
}: {
  today: TodayView
  dashboard: DashboardView
}) {
  const t = useT('today')
  const f = useFormat()
  const id = useId()
  const label = (item: TodayAgendaItem) =>
    item.kind === 'routine'
      ? t(`routine.${item.key}` as 'routine.wardRound')
      : t(`deadline.${item.key}` as 'deadline.stat')
  const current = today.agenda.find((a) => a.state === 'now')
  const next = today.agenda.find((a) => a.state === 'next')
  const todo = (key: TodayView['todo'][number]['key']) =>
    today.todo.find((x) => x.key === key)!
  const qc = today.priorities.find((p) => p.key === 'qc')?.count ?? 0
  const chips = (item: TodayAgendaItem): { text: string; warn?: boolean }[] => {
    if (item.state === 'done') return [{ text: t('chip.done') }]
    if (item.kind === 'deadline')
      return item.label
        ? [{ text: item.label, warn: item.state === 'overdue' }]
        : []
    switch (item.key) {
      case 'wardRound':
      case 'opdCollection':
      case 'eveningRound':
        return [
          { text: t('chip.collect', { count: todo('collection').count }) },
        ]
      case 'qcMorning':
        return qc ? [{ text: t('chip.qc', { count: qc }), warn: true }] : []
      case 'signOut':
        return [
          { text: t('chip.authorise', { count: todo('authorise').count }) },
        ]
      case 'handover':
        return [
          { text: t('chip.inProgress', { count: today.summary.inProgress }) },
        ]
      default:
        return []
    }
  }
  return (
    <section
      aria-labelledby={id}
      className={cn(CARD, '@container flex min-w-0 flex-col p-3.5 sm:p-4')}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={id} className="text-base font-semibold text-fg">
          {t('todayCard')}
        </h2>
        {current ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fg px-2.5 py-0.5 text-xs font-semibold text-surface">
            <span aria-hidden className="size-1.5 rounded-full bg-success" />
            {t('nowPill', { slot: label(current) })}
          </span>
        ) : null}
        {next ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <ClockIcon className="size-3.5" aria-hidden />
            {t('upNext', { time: f.time(next.at), label: label(next) })}
          </span>
        ) : null}
      </div>
      <HourStrip hourly={dashboard.hourly} />
      <ol className="mt-2 max-h-[18rem] scrollbar-thin space-y-px overflow-y-auto pr-1">
        {today.agenda.map((item) => {
          const isNow = item.state === 'now'
          const done = item.state === 'done'
          return (
            <li key={item.id}>
              <Link
                to={item.to}
                className={cn(
                  'focus-ring group flex items-center gap-2.5 rounded-xl px-2 py-1 transition-colors',
                  isNow ? 'bg-accent-soft' : 'hover:bg-surface-2',
                )}
              >
                <time
                  dateTime={new Date(item.at).toISOString()}
                  className={cn(
                    'w-[4.25rem] shrink-0 text-sm font-semibold tabular-nums',
                    item.state === 'overdue'
                      ? 'text-danger-text'
                      : done
                        ? 'text-fg-muted'
                        : 'text-fg',
                  )}
                >
                  {f.time(item.at)}
                </time>
                <span
                  aria-hidden
                  className={cn(
                    'hidden size-8 shrink-0 items-center justify-center rounded-full border @md:flex [&>svg]:size-3.5',
                    isNow
                      ? 'border-transparent bg-accent text-on-accent'
                      : item.state === 'overdue'
                        ? 'border-danger-text/30 text-danger-text'
                        : 'border-line-strong/60 text-fg-muted',
                  )}
                >
                  {done ? <CheckIcon /> : ROUTINE_ICON[item.key]}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-sm font-medium @md:truncate',
                      done ? 'text-fg-muted' : 'text-fg',
                    )}
                  >
                    {label(item)}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {chips(item).map((c) => (
                      <span
                        key={c.text}
                        className={cn(
                          'max-w-full truncate rounded-md px-1.5 py-px text-2xs',
                          c.warn
                            ? 'bg-warning-soft text-warning-text'
                            : 'bg-surface-2 text-fg-muted',
                        )}
                      >
                        {c.text}
                      </span>
                    ))}
                  </span>
                </span>
                {isNow ? (
                  <span className="rounded-full bg-fg px-2 py-0.5 text-2xs font-bold tracking-wide text-surface uppercase">
                    {t('state.now')}
                  </span>
                ) : item.state === 'overdue' ? (
                  <span className="text-2xs font-semibold tracking-wide text-danger-text uppercase">
                    {t('state.overdue')}
                  </span>
                ) : null}
                <ChevronRightIcon
                  className="size-4 shrink-0 text-fg-subtle"
                  aria-hidden
                />
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* ── Specimens today ─────────────────────────────────────────────────── */

const IN_LAB = new Set(['received', 'processing', 'on_hold'])

export function SpecimensToday() {
  const t = useT('today')
  const e = useEnum()
  const id = useId()
  const { department } = usePreferences()
  const [tab, setTab] = useState<'lab' | 'collect'>('lab')
  const { data, isPending, isError, refetch } = useWorkQueueList({
    bucket: 'all',
    q: '',
    ...(department ? { department } : {}),
  })
  const inLab = (data?.rows ?? []).filter((r) => IN_LAB.has(r.status))
  const toCollect = (data?.rows ?? []).filter(
    (r) => r.status === 'pending_collection',
  )
  const rows: WorkQueueRow[] = tab === 'lab' ? inLab : toCollect
  const tabs = [
    { key: 'lab' as const, label: t('tabInLab'), count: inLab.length },
    {
      key: 'collect' as const,
      label: t('tabToCollect'),
      count: toCollect.length,
    },
  ]
  return (
    <section
      aria-labelledby={id}
      className={cn(CARD, '@container flex min-w-0 flex-col p-3.5 sm:p-4')}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-base font-semibold text-fg">
          {t('specimensTitle')}
        </h2>
        <div
          role="tablist"
          aria-label={t('specimensTitle')}
          className="flex gap-1 rounded-full bg-surface-2 p-1"
        >
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => setTab(x.key)}
              className={cn(
                'focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold tracking-wide uppercase transition-colors pointer-coarse:min-h-11',
                tab === x.key
                  ? 'bg-fg text-surface'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {x.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-2xs tabular-nums',
                  tab === x.key
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface text-fg-muted',
                )}
              >
                {x.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-meta text-fg-muted">
          {t('specimensEmpty')}
        </p>
      ) : (
        <div
          role="tabpanel"
          className="max-h-[23rem] scrollbar-thin overflow-y-auto pr-1"
        >
          <ul className="divide-y divide-line">
            {rows.slice(0, 40).map((r) => (
              <li key={r.id}>
                <Link
                  to={`/specimens/${r.id}`}
                  className="focus-ring flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                >
                  <Avatar name={r.patient.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-meta font-medium text-fg">
                      {r.patient.name}
                    </span>
                    <span className="block truncate text-2xs text-fg-subtle">
                      <AgeSex dob={r.patient.dob} sex={r.patient.sex} /> ·{' '}
                      <span className="font-mono">
                        {r.accessionNo ?? r.patient.uhid}
                      </span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs @md:hidden">
                      {r.priority !== 'routine' ? (
                        <PriorityMark priority={r.priority} />
                      ) : null}
                      <span
                        className={
                          r.openCriticals
                            ? 'font-medium text-danger-text'
                            : 'text-fg-muted'
                        }
                      >
                        {e('stage', r.stage)}
                      </span>
                    </span>
                  </span>
                  {r.priority !== 'routine' ? (
                    <span className="hidden @md:inline-flex">
                      <PriorityMark priority={r.priority} />
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'hidden shrink-0 items-center gap-1 rounded-full px-2 py-px text-2xs font-medium @md:inline-flex',
                      r.openCriticals
                        ? 'bg-danger-soft text-danger-text'
                        : r.status === 'pending_collection' ||
                            r.status === 'received'
                          ? 'bg-warning-soft text-warning-text'
                          : 'bg-surface-2 text-fg-muted',
                    )}
                  >
                    {r.openCriticals ? (
                      <BellRingIcon className="size-3" aria-hidden />
                    ) : (
                      <ClockIcon className="size-3" aria-hidden />
                    )}
                    {e('stage', r.stage)}
                  </span>
                  <ChevronRightIcon
                    className="size-4 shrink-0 text-fg-subtle"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link
        to="/work-queue"
        className="tap-reach mt-2 inline-flex min-h-[24px] items-center gap-1 self-start text-xs font-semibold text-accent-text hover:underline"
      >
        {t('viewAllWork')}
        <ChevronRightIcon className="size-4" aria-hidden />
      </Link>
    </section>
  )
}

/* ── Needs action ─────────────────────────────────────────────────────── */

const SEVERITY_ICON: Record<TodaySeverity, ReactNode> = {
  critical: <CircleAlertIcon className="size-[18px] text-danger" />,
  high: <TriangleAlertIcon className="size-[18px] text-warning" />,
  medium: <TriangleAlertIcon className="size-[18px] text-warning" />,
  info: <CircleIcon className="size-[18px] text-stat-violet-solid" />,
}

const TODO_ICON: Record<TodayView['todo'][number]['key'], ReactNode> = {
  critical: <BellRingIcon />,
  collection: <SyringeIcon />,
  reception: <TestTubeIcon />,
  entry: <PencilLineIcon />,
  verify: <BadgeCheckIcon />,
  authorise: <PenLineIcon />,
  release: <FileTextIcon />,
  recollection: <RefreshCwIcon />,
}

export function NeedsAction({ today }: { today: TodayView }) {
  const t = useT('today')
  const f = useFormat()
  const now = useNow()
  const id = useId()
  const critical = today.priorities.find((p) => p.key === 'critical')
  return (
    <section aria-labelledby={id} className={cn(CARD, 'min-w-0 p-3.5 sm:p-4')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-base font-semibold text-fg">
          {t('needsAction')}
        </h2>
        {critical ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger-text">
            <CircleAlertIcon className="size-3.5" aria-hidden />
            {t('criticalCount', { count: critical.count })}
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @4xl:divide-x @4xl:divide-line">
        <div className="min-w-0 @4xl:pr-5">
          <p className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">
            <span>
              {t('attention')}{' '}
              <span className="ml-1 rounded-md bg-surface-2 px-1.5 py-0.5 tabular-nums">
                {today.priorities.length}
              </span>
            </span>
            <span className="font-normal tracking-normal normal-case">
              {t('mostUrgentFirst')}
            </span>
          </p>
          {today.priorities.length === 0 ? (
            <p className="py-4 text-meta text-success-text">
              {t('prioritiesEmpty')}
            </p>
          ) : (
            <ul className="grid gap-1">
              {today.priorities.map((p) => (
                <li key={p.key}>
                  <Link
                    to={p.to}
                    className={cn(
                      'focus-ring group flex items-center gap-2.5 rounded-xl px-2 py-1 transition-colors',
                      p.severity === 'critical'
                        ? 'bg-danger-soft hover:bg-danger-soft/80'
                        : 'hover:bg-surface-2',
                    )}
                  >
                    <span aria-hidden className="shrink-0">
                      {SEVERITY_ICON[p.severity]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">
                        {t(`priority.${p.key}`, { count: p.count })}
                      </span>
                      <span className="block text-xs text-fg-muted">
                        <span className="sr-only">
                          {t(`severity.${p.severity}`)} ·{' '}
                        </span>
                        {p.key === 'critical'
                          ? p.overdue
                            ? t('pastLimit', { count: p.overdue })
                            : t('notifyRequired')
                          : p.oldestAt !== undefined
                            ? t('oldest', { age: f.duration(now - p.oldestAt) })
                            : t(`severity.${p.severity}`)}
                      </span>
                    </span>
                    <ChevronRightIcon
                      className="size-4 shrink-0 text-fg-subtle"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-0 @4xl:pl-5">
          <p className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">
            {t('tasks')}{' '}
            <span className="ml-1 rounded-md bg-surface-2 px-1.5 py-0.5 tabular-nums">
              {today.todo.reduce((n, x) => n + x.count, 0)}
            </span>
          </p>
          <ul className="grid gap-1">
            {today.todo.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className="focus-ring flex items-center gap-2.5 rounded-xl px-2 py-1 transition-colors hover:bg-surface-2"
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line text-fg-muted [&>svg]:size-4"
                  >
                    {TODO_ICON[item.key]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-meta font-medium text-fg">
                      {t(`todo.${item.key}`)}
                    </span>
                    {item.count > 0 && item.dueToday > 0 ? (
                      <span className="block text-xs text-warning-text">
                        {t('dueToday', { count: item.dueToday })}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums',
                      item.count === 0
                        ? 'bg-surface-2 text-fg-subtle'
                        : item.key === 'critical'
                          ? 'bg-danger-soft text-danger-text'
                          : 'bg-surface-2 text-fg',
                    )}
                  >
                    {f.number(item.count)}
                  </span>
                  <ChevronRightIcon
                    className="size-4 shrink-0 text-fg-subtle"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/**
 * The dashboard's home layout: greeting tiles, today's timeline, the
 * specimens in hand, the week, what needs action and the day's summary.
 */
export function DashboardHome({ dashboard }: { dashboard: DashboardView }) {
  const { data: today, isPending, isError, refetch } = useToday()
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isPending)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-[4.5rem] rounded-2xl" />
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-[34rem] rounded-2xl" />
          <Skeleton className="h-[34rem] rounded-2xl" />
          <Skeleton className="h-[34rem] rounded-2xl" />
        </div>
      </div>
    )
  return (
    <div className="@container grid gap-4">
      <StatTiles today={today} />
      <div className="grid gap-4 @4xl:grid-cols-2 @7xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.3fr)_minmax(0,0.85fr)]">
        <TodayCard today={today} dashboard={dashboard} />
        <SpecimensToday />
        <CalendarCard className="@4xl:col-span-2 @7xl:col-span-1" />
        <div className="@4xl:col-span-2 @7xl:col-span-3">
          <NeedsAction today={today} />
        </div>
      </div>
    </div>
  )
}
