import { FunnelIcon, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Count } from '../ui/badge'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/menu'

export interface FilterChip {
  key: string
  /** "Field: value", in words. */
  label: string
  onRemove: () => void
}

/**
 * One row of list filters: the primary filters inline, secondary ones behind
 * "More filters" (with a count of those in use), and "Clear all" once any
 * filter is active. Filters set behind "More filters" also show as removable
 * chips, so nothing hidden narrows the list unseen. Wraps on narrow screens.
 */
export function FilterBar({
  children,
  more,
  moreCount = 0,
  onClear,
  canClear,
  chips,
  className,
}: {
  children: ReactNode
  /** Secondary filters, shown in a popover. */
  more?: ReactNode
  /** How many of the secondary filters are set. */
  moreCount?: number
  onClear?: () => void
  canClear?: boolean
  chips?: FilterChip[]
  className?: string
}) {
  const t = useT('common')
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5',
        className,
      )}
    >
      {children}
      {more ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant={moreCount ? 'soft' : 'secondary'}>
              <FunnelIcon />
              {t('moreFilters')}
              {moreCount ? <Count value={moreCount} tone="accent" /> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="grid w-[min(22rem,calc(100vw-2rem))] gap-3 p-4"
          >
            {more}
          </PopoverContent>
        </Popover>
      ) : null}
      {onClear && canClear ? (
        <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">
          <XIcon />
          {t('clearAll')}
        </Button>
      ) : null}
      {chips?.length ? (
        <ul
          className="flex basis-full flex-wrap items-center gap-1.5"
          aria-label={t('activeFilters')}
        >
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={t('removeFilter', { filter: chip.label })}
                className="focus-ring tap-reach inline-flex min-h-7 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs text-fg transition-colors hover:bg-surface-3"
              >
                {chip.label}
                <XIcon className="size-3.5 text-fg-subtle" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
