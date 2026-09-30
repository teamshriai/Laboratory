import { Tooltip as T } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const TooltipProvider = T.Provider

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  className,
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  if (!content) return <>{children}</>
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-70 max-w-72 animate-pop rounded-lg bg-fg px-2 py-1 text-xs font-medium text-canvas shadow-overlay',
            className,
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
