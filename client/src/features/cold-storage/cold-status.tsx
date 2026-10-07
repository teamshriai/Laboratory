import {
  CircleCheckIcon,
  CircleDashedIcon,
  ClockAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useT } from '@/i18n/context'
import { Badge } from '@/components/ui/badge'

/** In or out of the allowed range, always with an icon and text. */
export function RangeBadge({
  outOfRange,
  size = 'sm',
}: {
  outOfRange: boolean | undefined
  size?: 'sm' | 'md'
}) {
  const t = useT('coldStorage')
  if (outOfRange === undefined)
    return (
      <Badge tone="neutral" size={size}>
        <CircleDashedIcon aria-hidden />
        {t('noReading')}
      </Badge>
    )
  return outOfRange ? (
    <Badge tone="danger" size={size}>
      <TriangleAlertIcon aria-hidden />
      {t('outOfRange')}
    </Badge>
  ) : (
    <Badge tone="success" size={size}>
      <CircleCheckIcon aria-hidden />
      {t('inRange')}
    </Badge>
  )
}

/** No reading for over 14 hours. */
export function OverdueBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const t = useT('coldStorage')
  return (
    <Badge tone="warning" size={size}>
      <ClockAlertIcon aria-hidden />
      {t('overdue')}
    </Badge>
  )
}
