import {
  CircleCheckBigIcon,
  CircleSlashIcon,
  ClockIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  SendIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { MessageChannel, MessageState } from '@/domain/types'
import { useEnum } from '@/i18n/context'
import type { IconTone } from '@/lib/icon-tones'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { IconGlyph } from '@/components/ui/icon-tile'

const TONES: Record<MessageChannel, IconTone> = {
  sms: 'sky',
  whatsapp: 'green',
  email: 'violet',
}

/** The channel's glyph (decorative; the label carries the meaning). */
export function ChannelIcon({
  channel,
  size = 16,
}: {
  channel: MessageChannel
  size?: number
}) {
  const icon =
    channel === 'sms' ? (
      <MessageSquareTextIcon />
    ) : channel === 'whatsapp' ? (
      <MessageCircleIcon />
    ) : (
      <MailIcon />
    )
  return <IconGlyph icon={icon} tone={TONES[channel]} size={size} />
}

/** Icon and name of a messaging channel. */
export function ChannelLabel({
  channel,
  className,
}: {
  channel: MessageChannel
  className?: string
}) {
  const e = useEnum()
  return (
    <span
      className={
        className ??
        'inline-flex items-center gap-1.5 text-meta whitespace-nowrap text-fg'
      }
    >
      <ChannelIcon channel={channel} />
      {e('messageChannel', channel)}
    </span>
  )
}

const STATE_TONE: Record<MessageState, BadgeTone> = {
  'not-sent': 'warning',
  queued: 'info',
  sent: 'info',
  delivered: 'success',
  failed: 'danger',
}

/** A message's delivery state, as an icon and words (never colour alone). */
export function MessageStateBadge({ state }: { state: MessageState }) {
  const e = useEnum()
  const icon =
    state === 'not-sent' ? (
      <CircleSlashIcon aria-hidden />
    ) : state === 'queued' ? (
      <ClockIcon aria-hidden />
    ) : state === 'sent' ? (
      <SendIcon aria-hidden />
    ) : state === 'delivered' ? (
      <CircleCheckBigIcon aria-hidden />
    ) : (
      <TriangleAlertIcon aria-hidden />
    )
  return (
    <Badge size="sm" tone={STATE_TONE[state]}>
      {icon}
      {e('messageState', state)}
    </Badge>
  )
}
