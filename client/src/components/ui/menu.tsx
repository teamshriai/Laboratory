import { CheckIcon } from 'lucide-react'
import { DropdownMenu as M, Popover as P } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Menu = M.Root
export const MenuTrigger = M.Trigger
export const MenuGroup = M.Group
export const MenuRadioGroup = M.RadioGroup

const panel =
  'animate-pop z-60 min-w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 text-sm shadow-card-lg'
const itemClass =
  'relative flex min-h-10 cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-fg-muted outline-none data-highlighted:text-fg select-none data-disabled:opacity-40 data-highlighted:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted'

export function MenuContent({
  children,
  align = 'end',
  className,
  sideOffset = 6,
}: {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  sideOffset?: number
}) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(panel, className)}
      >
        {children}
      </M.Content>
    </M.Portal>
  )
}

export function MenuItem({
  children,
  icon,
  onSelect,
  danger,
  disabled,
  hint,
}: {
  children: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
  hint?: ReactNode
}) {
  return (
    <M.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        itemClass,
        danger &&
          'text-danger-text data-highlighted:bg-danger-soft [&_svg]:text-danger-text',
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {hint ? <span className="text-xs text-fg-subtle">{hint}</span> : null}
    </M.Item>
  )
}

export function MenuRadioItem({
  value,
  children,
  icon,
}: {
  value: string
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <M.RadioItem value={value} className={cn(itemClass, 'pr-8')}>
      {icon}
      <span className="flex-1">{children}</span>
      <M.ItemIndicator className="absolute right-2.5">
        <CheckIcon strokeWidth={2.5} className="!text-accent-text" />
      </M.ItemIndicator>
    </M.RadioItem>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <M.Label className="px-2.5 pt-2 pb-1 text-2xs font-semibold tracking-wide text-fg-subtle uppercase">
      {children}
    </M.Label>
  )
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-line" />
}

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverClose = P.Close

export function PopoverContent({
  children,
  align = 'end',
  className,
  sideOffset = 8,
}: {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  sideOffset?: number
}) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          'z-60 animate-pop rounded-xl border border-line bg-surface shadow-card-lg outline-none',
          className,
        )}
      >
        {children}
      </P.Content>
    </P.Portal>
  )
}
