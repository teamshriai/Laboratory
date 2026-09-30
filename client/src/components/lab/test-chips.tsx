import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import type { TestChip } from '@/services/lab-api'
import { Tooltip } from '../ui/tooltip'

export function TestChips({
  tests,
  max = 3,
  className,
}: {
  tests: Pick<TestChip, 'itemId' | 'shortName' | 'name' | 'active'>[]
  max?: number
  className?: string
}) {
  const t = useT('orders')
  const live = tests.filter((x) => x.active)
  const shown = live.slice(0, max)
  const rest = live.slice(max)
  return (
    <span
      data-test-chips=""
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      {shown.map((x) => (
        <Tooltip key={x.itemId} content={x.name}>
          <span className="inline-flex h-6 items-center rounded-md bg-surface-2 px-2 text-xs font-medium whitespace-nowrap text-fg ring-1 ring-line ring-inset">
            {x.shortName}
          </span>
        </Tooltip>
      ))}
      {rest.length > 0 ? (
        <Tooltip content={rest.map((x) => x.shortName).join(', ')}>
          <span className="inline-flex h-6 items-center rounded-md px-1.5 text-xs font-medium whitespace-nowrap text-fg-muted">
            {t('moreTests', { count: rest.length })}
          </span>
        </Tooltip>
      ) : null}
    </span>
  )
}
