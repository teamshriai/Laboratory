import { FunnelIcon, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Count } from '../ui/badge'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/menu'

/**
 * One row of list filters: the primary filters inline, secondary ones behind
 * "More filters" (with a count of those in use), and "Clear all" once any
 * filter is active. Wraps on narrow screens.
 */
export function FilterBar({
  children,
  more,
  moreCount = 0,
  onClear,
  canClear,
  className,
}: {
  children: ReactNode
  /** Secondary filters, shown in a popover. */
  more?: ReactNode
  /** How many of the secondary filters are set. */
  moreCount?: number
  onClear?: () => void
  canClear?: boolean
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
    </div>
  )
}
