import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const badgeVariants = cva(
  'inline-flex max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-md border font-semibold select-none [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-2 text-fg-subtle',
        accent: 'border-accent-text/25 bg-primary-50 text-accent-text',
        success: 'border-success-text/25 bg-success-soft text-success-text',
        warning: 'border-warning-text/25 bg-warning-soft text-warning-text',
        danger: 'border-danger-text/25 bg-danger-soft text-danger-text',
        info: 'border-info-text/25 bg-info-soft text-info-text',
        solidDanger: 'border-transparent bg-danger text-on-danger',
        outline: 'border-line-strong bg-transparent text-fg-muted',
      },
      size: {
        sm: 'px-2 py-0.5 text-2xs',
        md: 'rounded-lg px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({
  className,
  tone,
  size,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
  )
}

/** Small counter pill for tabs and navigation. */
export function Count({
  value,
  tone = 'neutral',
  className,
}: {
  value: number
  tone?: 'neutral' | 'accent' | 'danger'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-2xs font-semibold tabular-nums',
        tone === 'danger'
          ? 'bg-danger text-on-danger'
          : tone === 'accent'
            ? 'bg-primary-100 text-accent-text'
            : 'bg-surface-3 text-fg-muted',
        className,
      )}
    >
      {value > 999 ? '999+' : value}
    </span>
  )
}
