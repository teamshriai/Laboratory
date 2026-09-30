import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { IconTone } from '@/lib/icon-tones'
import { SoftIconTile } from './icon-tile'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface shadow-card',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  tone = 'blue',
  className,
  titleAs: TitleTag = 'h2',
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  /** Hue of the section's soft icon tile (its destination hue). */
  tone?: IconTone
  className?: string
  titleAs?: 'h2' | 'h3'
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3.5 pb-3 sm:px-5',
        className,
      )}
    >
      <div className="flex min-h-11 min-w-0 items-center gap-2.5">
        {icon ? <SoftIconTile icon={icon} tone={tone} size="md" /> : null}
        <div className="min-w-0">
          <TitleTag className="text-sm leading-snug font-semibold text-fg">
            {title}
          </TitleTag>
          {description ? (
            <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? (
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  )
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 pb-4 sm:px-5 sm:pb-5', className)} {...props} />
  )
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-t border-line px-5 py-3',
        className,
      )}
      {...props}
    />
  )
}

/** Label / value pair used in detail cards. */
export function Detail({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-fg">
        {children}
      </dd>
    </div>
  )
}
