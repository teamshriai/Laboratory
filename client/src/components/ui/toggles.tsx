import { CheckIcon, MinusIcon } from 'lucide-react'
import {
  Checkbox as C,
  RadioGroup as R,
  Switch as Sw,
  ToggleGroup as TG,
} from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Count } from './badge'

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
  id,
}: {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
  id?: string
}) {
  return (
    <C.Root
      id={id}
      checked={checked}
      onCheckedChange={(c) => onCheckedChange(c === true)}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'tap-reach grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-line-strong bg-surface text-on-accent transition-colors hover:border-accent disabled:opacity-40 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent',
        className,
      )}
    >
      <C.Indicator>
        {checked === 'indeterminate' ? (
          <MinusIcon className="size-3" strokeWidth={2.5} />
        ) : (
          <CheckIcon className="size-3" strokeWidth={2.5} />
        )}
      </C.Indicator>
    </C.Root>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  id,
  label,
  disabled,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
  label?: string
  disabled?: boolean
}) {
  return (
    <Sw.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      disabled={disabled}
      className="tap-reach relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-surface-3 ring-1 ring-line-strong/40 transition-colors duration-300 ring-inset disabled:opacity-40 data-[state=checked]:bg-accent data-[state=checked]:ring-transparent"
    >
      <Sw.Thumb className="block size-4 translate-x-1 rounded-full bg-surface shadow-card transition-transform duration-200 ease-(--ease-premium) data-[state=checked]:translate-x-6" />
    </Sw.Root>
  )
}

export interface ChoiceOption<V extends string> {
  value: V
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
}

/** Radio options presented as selectable cards. */
export function ChoiceCards<V extends string>({
  value,
  onValueChange,
  options,
  columns = 3,
  className,
  'aria-label': ariaLabel,
}: {
  value: V | undefined
  onValueChange: (value: V) => void
  options: ChoiceOption<V>[]
  columns?: 2 | 3 | 4
  className?: string
  'aria-label'?: string
}) {
  return (
    <R.Root
      value={value}
      onValueChange={(v) => onValueChange(v as V)}
      aria-label={ariaLabel}
      className={cn(
        'grid gap-2',
        columns === 2
          ? 'sm:grid-cols-2'
          : columns === 4
            ? 'grid-cols-2 lg:grid-cols-4'
            : 'sm:grid-cols-3',
        className,
      )}
    >
      {options.map((o) => (
        <R.Item
          key={o.value}
          value={o.value}
          className="focus-ring group flex min-h-11 items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5 text-left transition-[border-color,background-color] hover:border-line-strong data-[state=checked]:border-accent data-[state=checked]:bg-accent-soft"
        >
          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-line-strong bg-surface group-data-[state=checked]:border-accent">
            <R.Indicator className="size-2 rounded-full bg-accent" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium text-fg [&_svg]:size-4">
              {o.icon}
              {o.label}
            </span>
            {o.description ? (
              <span className="mt-0.5 block text-xs text-fg-muted">
                {o.description}
              </span>
            ) : null}
          </span>
        </R.Item>
      ))}
    </R.Root>
  )
}

/** Compact single-choice control (theme, range, view). */
export function Segmented<V extends string>({
  value,
  onValueChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  value: V
  onValueChange: (value: V) => void
  options: { value: V; label: ReactNode; icon?: ReactNode }[]
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}) {
  return (
    <TG.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as V)}
      aria-label={ariaLabel}
      className={cn(
        'scrollbar-hide inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((o) => (
        <TG.Item
          key={o.value}
          value={o.value}
          className={cn(
            'focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap text-fg-muted transition-colors hover:text-fg data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-card pointer-coarse:min-w-11 [&_svg]:size-4',
            size === 'sm'
              ? 'h-8 px-3 text-xs pointer-coarse:h-11'
              : 'min-h-10 px-4 text-sm pointer-coarse:min-h-11',
          )}
        >
          {o.icon}
          {o.label}
        </TG.Item>
      ))}
    </TG.Root>
  )
}

/** Status tabs with counts that filter a list (not panel tabs). */
export function FilterTabs<V extends string>({
  value,
  onValueChange,
  items,
  className,
  'aria-label': ariaLabel,
}: {
  value: V
  onValueChange: (value: V) => void
  items: {
    value: V
    label: ReactNode
    count?: number
    tone?: 'neutral' | 'danger' | 'accent'
  }[]
  className?: string
  'aria-label'?: string
}) {
  return (
    <TG.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as V)}
      aria-label={ariaLabel}
      className={cn(
        'scrollbar-hide -mb-px flex gap-1 overflow-x-auto',
        className,
      )}
    >
      {items.map((item) => (
        <TG.Item
          key={item.value}
          value={item.value}
          className="focus-ring group clinical-row -mb-px inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-fg-subtle transition-colors hover:text-fg data-[state=on]:border-accent data-[state=on]:text-accent-text"
        >
          {item.label}
          {item.count !== undefined ? (
            <Count
              value={item.count}
              tone={
                item.tone === 'danger' && item.count > 0 ? 'danger' : 'neutral'
              }
              className="group-data-[state=on]:bg-primary-100 group-data-[state=on]:text-accent-text"
            />
          ) : null}
        </TG.Item>
      ))}
    </TG.Root>
  )
}
