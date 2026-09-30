import { ChevronsUpDownIcon, CheckIcon } from 'lucide-react'
import { Command } from 'cmdk'
import { Popover } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { controlClass } from './input'

export interface ComboOption {
  value: string
  label: string
  description?: ReactNode
  keywords?: string[]
  group?: string
}

interface ComboboxProps {
  value: string | undefined
  onValueChange: (value: string) => void
  options: ComboOption[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  id?: string
  className?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  renderValue?: (option: ComboOption) => ReactNode
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
  renderValue,
  ...rest
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const groups = [...new Set(options.map((o) => o.group ?? ''))]
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          id={rest.id}
          aria-invalid={rest['aria-invalid']}
          aria-describedby={rest['aria-describedby']}
          className={cn(
            controlClass,
            'flex h-11 items-center gap-2 px-3.5 text-left',
            className,
          )}
        >
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              !selected && 'text-fg-subtle',
            )}
          >
            {selected
              ? renderValue
                ? renderValue(selected)
                : selected.label
              : placeholder}
          </span>
          <ChevronsUpDownIcon className="size-3.5 text-fg-subtle" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-60 w-[max(var(--radix-popover-trigger-width),18rem)] animate-pop overflow-hidden rounded-xl border border-line bg-surface shadow-card-lg"
        >
          <Command className="flex flex-col">
            <Command.Input
              placeholder={searchPlaceholder}
              className="h-11 border-b border-line bg-transparent px-3 text-sm text-fg outline-none placeholder:text-fg-subtle"
            />
            <Command.List className="max-h-72 scrollbar-thin overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-meta text-fg-muted">
                {emptyText}
              </Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group || 'default'}
                  heading={group || undefined}
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-fg-subtle [&_[cmdk-group-heading]]:uppercase"
                >
                  {options
                    .filter((o) => (o.group ?? '') === group)
                    .map((o) => (
                      <Command.Item
                        key={o.value}
                        value={`${o.label} ${o.value}`}
                        keywords={o.keywords}
                        onSelect={() => {
                          onValueChange(o.value)
                          setOpen(false)
                        }}
                        className="flex cursor-default items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg outline-none select-none data-[selected=true]:bg-surface-2"
                      >
                        <CheckIcon
                          className={cn(
                            'mt-0.5 size-4 text-accent-text',
                            o.value === value ? 'opacity-100' : 'opacity-0',
                          )}
                          strokeWidth={2.5}
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{o.label}</span>
                          {o.description ? (
                            <span className="block text-xs text-fg-muted">
                              {o.description}
                            </span>
                          ) : null}
                        </span>
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
