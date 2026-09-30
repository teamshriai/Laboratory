import { Tabs as T } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Count } from './badge'

export const Tabs = T.Root
export const TabsContent = ({ className, ...props }: T.TabsContentProps) => (
  <T.Content className={cn('outline-none', className)} {...props} />
)

export function TabsList({
  items,
  className,
}: {
  items: { value: string; label: ReactNode; count?: number; icon?: ReactNode }[]
  className?: string
}) {
  return (
    <T.List
      className={cn(
        'scrollbar-hide flex gap-1 overflow-x-auto border-b border-line',
        className,
      )}
    >
      {items.map((item) => (
        <T.Trigger
          key={item.value}
          value={item.value}
          className="focus-ring group -mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-fg-subtle transition-colors hover:text-fg data-[state=active]:border-accent data-[state=active]:text-accent-text [&_svg]:size-4"
        >
          {item.icon}
          {item.label}
          {item.count !== undefined ? (
            <Count
              value={item.count}
              className="group-data-[state=active]:bg-primary-100 group-data-[state=active]:text-accent-text"
            />
          ) : null}
        </T.Trigger>
      ))}
    </T.List>
  )
}
