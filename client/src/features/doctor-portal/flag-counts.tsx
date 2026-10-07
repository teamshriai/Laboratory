import {
  CircleCheckIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useT } from '@/i18n/context'
import { Badge } from '@/components/ui/badge'

/**
 * Critical and abnormal result counts as badges with an icon and text (never
 * colour alone). At most two badges, as the table rules ask.
 */
export function FlagCounts({
  critical,
  abnormal,
  hasReports = true,
}: {
  critical: number
  abnormal: number
  hasReports?: boolean
}) {
  const t = useT('doctorPortal')
  if (!hasReports) return null
  if (critical === 0 && abnormal === 0)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
        <CircleCheckIcon
          className="size-3.5 shrink-0 text-success-text"
          aria-hidden
        />
        {t('allWithinInterval')}
      </span>
    )
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {critical > 0 ? (
        <Badge tone="danger" size="sm">
          <OctagonAlertIcon strokeWidth={2.2} aria-hidden />
          {t('critical', { count: critical })}
        </Badge>
      ) : null}
      {abnormal > 0 ? (
        <Badge tone="warning" size="sm">
          <TriangleAlertIcon aria-hidden />
          {t('abnormal', { count: abnormal })}
        </Badge>
      ) : null}
    </div>
  )
}
