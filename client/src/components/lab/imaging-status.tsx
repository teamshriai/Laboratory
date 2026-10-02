import {
  BadgeCheckIcon,
  CalendarClockIcon,
  FileClockIcon,
  FilePenLineIcon,
  HourglassIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { ImagingStatus } from '@/domain/types'
import { useT } from '@/i18n/context'
import { Badge, type BadgeTone } from '../ui/badge'

const LOOK: Record<ImagingStatus, { tone: BadgeTone; icon: ReactNode }> = {
  scheduled: { tone: 'neutral', icon: <CalendarClockIcon /> },
  acquired: { tone: 'warning', icon: <HourglassIcon /> },
  reported: { tone: 'info', icon: <FileClockIcon /> },
  final: { tone: 'success', icon: <BadgeCheckIcon /> },
  amended: { tone: 'warning', icon: <FilePenLineIcon /> },
}

/** Where an imaging study stands, in words with an icon. */
export function ImagingStatusBadge({
  status,
  size = 'sm',
}: {
  status: ImagingStatus
  size?: 'sm' | 'md'
}) {
  const t = useT('imaging')
  const look = LOOK[status]
  return (
    <Badge tone={look.tone} size={size}>
      {look.icon}
      {t(`status.${status}`)}
    </Badge>
  )
}
