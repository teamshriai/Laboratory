import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CircleCheckIcon,
  HourglassIcon,
  TriangleAlertIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react'
import type { InterfaceDirection, InterfaceState } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import type { InterfaceRow } from '@/services/lab-api'
import { Badge } from '@/components/ui/badge'

/** Online or offline, with an icon and the word (never colour alone). */
export function ConnectionLabel({
  connection,
  className,
}: {
  connection: InterfaceRow['connection']
  className?: string
}) {
  const e = useEnum()
  const online = connection === 'online'
  const Icon = online ? WifiIcon : WifiOffIcon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-meta font-medium whitespace-nowrap',
        online ? 'text-success-text' : 'text-danger-text',
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {e('connection', connection)}
    </span>
  )
}

const STATE_TONE = {
  processed: 'success',
  error: 'danger',
  pending: 'info',
} as const

const STATE_ICON = {
  processed: CircleCheckIcon,
  error: TriangleAlertIcon,
  pending: HourglassIcon,
} as const

export function MessageStateBadge({ state }: { state: InterfaceState }) {
  const t = useT('interfaces')
  const Icon = STATE_ICON[state]
  return (
    <Badge tone={STATE_TONE[state]} size="sm">
      <Icon aria-hidden />
      {t(`state.${state}`)}
    </Badge>
  )
}

/** Which way a message went, from the laboratory's side. */
export function DirectionLabel({
  direction,
}: {
  direction: InterfaceDirection
}) {
  const t = useT('interfaces')
  const Icon = direction === 'in' ? ArrowDownLeftIcon : ArrowUpRightIcon
  return (
    <span className="inline-flex items-center gap-1 text-meta whitespace-nowrap text-fg-muted">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {t(`direction.${direction}`)}
    </span>
  )
}
