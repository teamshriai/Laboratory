import {
  AlarmClockIcon,
  BanIcon,
  CircleCheckIcon,
  CircleDotIcon,
  ClockIcon,
  FileSearchIcon,
  HourglassIcon,
  LockIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
  UserCheckIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  BreachState,
  DataRequestState,
  HistoryEntry,
} from '@/domain/types'
import { useT } from '@/i18n/context'
import type { TKey } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { Timeline, type TimelineEntry } from '@/components/ui/misc'

const STATUS_TEXT =
  'inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0'

const REQUEST_STATE: Record<
  DataRequestState,
  { icon: ReactNode; className: string }
> = {
  received: { icon: <CircleDotIcon />, className: 'text-info-text' },
  verifying: { icon: <UserCheckIcon />, className: 'text-info-text' },
  'in-progress': { icon: <HourglassIcon />, className: 'text-accent-text' },
  completed: { icon: <CircleCheckIcon />, className: 'text-success-text' },
  refused: { icon: <BanIcon />, className: 'text-fg-muted' },
}

export function RequestState({ state }: { state: DataRequestState }) {
  const t = useT('privacy')
  const spec = REQUEST_STATE[state]
  return (
    <span className={cn(STATUS_TEXT, spec.className)}>
      <span aria-hidden className="contents">
        {spec.icon}
      </span>
      {t(`state.${state}`)}
    </span>
  )
}

const BREACH_STATE: Record<
  BreachState,
  { icon: ReactNode; className: string }
> = {
  open: { icon: <ShieldAlertIcon />, className: 'text-danger-text' },
  contained: { icon: <LockIcon />, className: 'text-warning-text' },
  closed: { icon: <CircleCheckIcon />, className: 'text-success-text' },
}

export function IncidentState({ state }: { state: BreachState }) {
  const t = useT('privacy')
  const spec = BREACH_STATE[state]
  return (
    <span className={cn(STATUS_TEXT, spec.className)}>
      <span aria-hidden className="contents">
        {spec.icon}
      </span>
      {t(`breachState.${state}`)}
    </span>
  )
}

/** "Overdue" with an icon, for a request past its due date. */
export function OverdueFlag() {
  const t = useT('privacy')
  return (
    <span className={cn(STATUS_TEXT, 'text-danger-text')}>
      <AlarmClockIcon aria-hidden />
      {t('overdue')}
    </span>
  )
}

export function HoldFlag() {
  const t = useT('privacy')
  return (
    <span className={cn(STATUS_TEXT, 'text-warning-text')}>
      <LockIcon aria-hidden />
      {t('legalHold')}
    </span>
  )
}

/**
 * A reporting deadline: when it falls due, and whether it was met, is
 * running or has passed.
 */
export function Deadline({
  dueAt,
  doneAt,
  late,
  now,
  compact,
}: {
  dueAt: number
  doneAt: number | undefined
  late: boolean
  now: number
  /** Table cell: one line, no due time. */
  compact?: boolean
}) {
  const t = useT('privacy')
  const f = useFormat()
  let status: ReactNode
  if (doneAt !== undefined)
    status = late ? (
      <span className={cn(STATUS_TEXT, 'text-warning-text')}>
        <TriangleAlertIcon aria-hidden />
        {t('reportedLate', { duration: f.duration(doneAt - dueAt) })}
      </span>
    ) : (
      <span className={cn(STATUS_TEXT, 'text-success-text')}>
        <CircleCheckIcon aria-hidden />
        {compact
          ? t('reportedOnTime')
          : t('reportedAt', { time: f.dateTime(doneAt) })}
      </span>
    )
  else if (now > dueAt)
    status = (
      <span className={cn(STATUS_TEXT, 'text-danger-text')}>
        <AlarmClockIcon aria-hidden />
        {t('overdueBy', { duration: f.duration(now - dueAt) })}
      </span>
    )
  else
    status = (
      <span className={cn(STATUS_TEXT, 'text-warning-text')}>
        <ClockIcon aria-hidden />
        {t('dueIn', { duration: f.duration(dueAt - now) })}
      </span>
    )
  if (compact) return status
  return (
    <div className="grid gap-0.5">
      {status}
      <span className="text-xs text-fg-muted">
        {t('dueAt', { time: f.dateTime(dueAt) })}
      </span>
    </div>
  )
}

const EVENT_TONE: Record<string, TimelineEntry['tone']> = {
  'request-completed': 'success',
  'request-refused': 'neutral',
  'breach-logged': 'danger',
  'breach-contained': 'warning',
  'breach-closed': 'success',
}

/** A request's or incident's history, newest last, with any note. */
export function EventTimeline({
  entries,
}: {
  entries: (HistoryEntry & { byName: string })[]
}) {
  const t = useT('privacy')
  const f = useFormat()
  const label = (type: string) => {
    const key = `event.${type}`
    const text = t(key as TKey<'privacy'>)
    return text === key ? type : text
  }
  const items: TimelineEntry[] = entries.map((h) => {
    const note = h.params?.note
    return {
      id: h.id,
      title: (
        <>
          {label(h.type)}
          {note ? (
            <span className="mt-0.5 block text-meta whitespace-pre-line text-fg-muted">
              {String(note)}
            </span>
          ) : null}
        </>
      ),
      meta: `${f.dateTime(h.at)} · ${h.byName}`,
      icon: <FileSearchIcon />,
      tone: EVENT_TONE[h.type] ?? 'accent',
    }
  })
  return <Timeline items={items} />
}

/** A label and value in a drawer's details list. */
export function Item({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-fg">{children}</dd>
    </div>
  )
}
