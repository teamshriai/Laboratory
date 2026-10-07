import {
  BanIcon,
  BikeIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  CircleXIcon,
  UserCheckIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { HomeVisitState } from '@/domain/types'
import { useEnum } from '@/i18n/context'
import { Badge, type BadgeTone } from '@/components/ui/badge'

const SPEC: Record<HomeVisitState, { tone: BadgeTone; icon: ReactNode }> = {
  booked: { tone: 'info', icon: <CalendarClockIcon /> },
  assigned: { tone: 'neutral', icon: <UserCheckIcon /> },
  'en-route': { tone: 'accent', icon: <BikeIcon /> },
  collected: { tone: 'success', icon: <CircleCheckIcon /> },
  cancelled: { tone: 'outline', icon: <BanIcon /> },
  missed: { tone: 'warning', icon: <CircleXIcon /> },
}

/** A home visit's state: icon and words, never colour alone. */
export function VisitStateBadge({
  state,
  size = 'sm',
}: {
  state: HomeVisitState
  size?: 'sm' | 'md'
}) {
  const e = useEnum()
  const spec = SPEC[state]
  return (
    <Badge tone={spec.tone} size={size}>
      <span aria-hidden className="contents">
        {spec.icon}
      </span>
      {e('homeVisitState', state)}
    </Badge>
  )
}
