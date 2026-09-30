import { ClockIcon } from 'lucide-react'
import type { TatInfo, TatState } from '@/domain/tat'
import { APPROACHING_RATIO } from '@/domain/tat'
import { useNow } from '@/hooks/use-now'
import { useEnum } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { Tooltip } from '../ui/tooltip'

/** Recomputes TAT against the live clock so values tick without refetching. */
export function useLiveTat(tat: TatInfo | null | undefined): TatInfo | null {
  const now = useNow()
  if (!tat || tat.startAt === null) return tat ?? null
  if (tat.endAt !== null) return tat
  const elapsedMs = Math.max(0, now - tat.startAt)
  const ratio = tat.targetMs > 0 ? elapsedMs / tat.targetMs : 0
  const state: TatState =
    ratio > 1
      ? 'breached'
      : ratio >= APPROACHING_RATIO
        ? 'approaching'
        : 'on-track'
  return { ...tat, elapsedMs, ratio, state }
}

const TONE: Record<TatState, string> = {
  'not-started': 'text-fg-subtle',
  'on-track': 'text-fg-muted',
  approaching: 'text-warning-text',
  breached: 'text-danger-text',
  met: 'text-success-text',
  missed: 'text-danger-text',
}
const BAR: Record<TatState, string> = {
  'not-started': 'bg-surface-3',
  'on-track': 'bg-accent',
  approaching: 'bg-warning',
  breached: 'bg-danger',
  met: 'bg-success',
  missed: 'bg-danger',
}

export function TatIndicator({
  tat: raw,
  compact,
  className,
}: {
  tat: TatInfo | null | undefined
  compact?: boolean
  className?: string
}) {
  const tat = useLiveTat(raw)
  const f = useFormat()
  const e = useEnum()
  if (!tat) return null
  if (tat.state === 'not-started')
    return (
      <span className={cn('text-xs text-fg-subtle', className)}>
        {e('tatState', 'not-started')}
      </span>
    )
  const label = `${f.duration(tat.elapsedMs)} / ${f.duration(tat.targetMs)}`
  return (
    <Tooltip content={`${e('tatState', tat.state)}: ${label}`}>
      <span
        className={cn(
          'inline-flex min-w-0 flex-col gap-1',
          compact ? 'min-w-20' : 'min-w-28',
          className,
        )}
        tabIndex={0}
      >
        <span
          className={cn(
            'flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular-nums',
            TONE[tat.state],
          )}
        >
          <ClockIcon className="size-3.5 shrink-0" />
          {f.duration(tat.elapsedMs)}
          {!compact ? (
            <span className="font-normal text-fg-subtle">
              / {f.duration(tat.targetMs)}
            </span>
          ) : null}
        </span>
        <span
          className="block h-1 overflow-hidden rounded-full bg-surface-3"
          aria-hidden
        >
          <span
            className={cn('block h-full rounded-full', BAR[tat.state])}
            style={{ width: `${Math.min(100, tat.ratio * 100)}%` }}
          />
        </span>
      </span>
    </Tooltip>
  )
}

/** Live "waiting for" duration since a timestamp. */
export function Waiting({
  since,
  warnAfterMin = 30,
  dangerAfterMin = 60,
  className,
}: {
  since: number
  warnAfterMin?: number
  dangerAfterMin?: number
  className?: string
}) {
  const now = useNow()
  const f = useFormat()
  const minutes = (now - since) / 60_000
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular-nums',
        minutes >= dangerAfterMin
          ? 'text-danger-text'
          : minutes >= warnAfterMin
            ? 'text-warning-text'
            : 'text-fg-muted',
        className,
      )}
    >
      <ClockIcon className="size-3.5" />
      {f.duration(now - since)}
    </span>
  )
}
