import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Button } from './button'
import type { IconTone } from '@/lib/icon-tones'
import { IconTile } from './icon-tile'

/** The large transparent glyph that heads empty and error states. */
function StateGlyph({
  children,
  compact,
  tone,
}: {
  children: ReactNode
  compact?: boolean
  tone: IconTone
}) {
  return (
    <IconTile
      icon={children}
      tone={tone}
      size={compact ? 'lg' : 'xl'}
      className="mb-4"
    />
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  tone = 'blue',
  className,
}: {
  icon: ReactNode
  tone?: IconTone
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <StateGlyph compact={compact} tone={tone}>
        {icon}
      </StateGlyph>
      <p className="text-base font-semibold text-fg">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-muted">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  )
}

export function ErrorState({
  title,
  description,
  onRetry,
  compact,
}: {
  title?: ReactNode
  description?: ReactNode
  onRetry?: () => void
  compact?: boolean
}) {
  const t = useT('errors')
  const tc = useT('common')
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
      )}
    >
      <StateGlyph compact={compact} tone="red">
        <TriangleAlertIcon />
      </StateGlyph>
      <p className="text-base font-semibold text-fg">
        {title ?? t('loadTitle')}
      </p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-muted">
        {description ?? t('loadBody')}
      </p>
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry}>
          <RotateCwIcon />
          {tc('retry')}
        </Button>
      ) : null}
    </div>
  )
}
