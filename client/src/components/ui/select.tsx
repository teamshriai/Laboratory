import { ChevronDownIcon, CheckIcon } from 'lucide-react'
import { Select as S } from 'radix-ui'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { controlClass } from './input'
import { useFieldControl } from './field-context'

export interface SelectOption<V extends string = string> {
  value: V
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

interface SelectProps<V extends string> {
  value: V | undefined
  onValueChange: (value: V) => void
  options: SelectOption<V>[]
  placeholder?: string
  id?: string
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  /** Leading icon inside the trigger. */
  icon?: ReactNode
}

function SelectInner<V extends string>(
  {
    value,
    onValueChange,
    options,
    placeholder,
    size = 'md',
    className,
    icon,
    ...rest
  }: SelectProps<V>,
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  const selected = options.find((o) => o.value === value)
  // Inside a Field, fall back on its id and descriptions (a Controller
  // between them does not pass props on).
  const field = useFieldControl()
  return (
    <S.Root
      value={value ?? ''}
      onValueChange={(v) => onValueChange(v as V)}
      disabled={rest.disabled}
    >
      <S.Trigger
        ref={ref}
        id={rest.id ?? field?.id}
        aria-label={rest['aria-label']}
        aria-invalid={rest['aria-invalid'] ?? field?.['aria-invalid']}
        aria-describedby={
          rest['aria-describedby'] ?? field?.['aria-describedby']
        }
        className={cn(
          controlClass,
          'flex items-center gap-2 text-left data-placeholder:text-fg-subtle',
          size === 'sm'
            ? 'h-9 px-2.5 text-xs font-medium pointer-coarse:h-11'
            : 'h-11 px-3.5',
          className,
        )}
      >
        {icon ? (
          <span className="text-fg-subtle [&_svg]:size-4">{icon}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">
          <S.Value placeholder={placeholder}>{selected?.label}</S.Value>
        </span>
        <S.Icon>
          <ChevronDownIcon className="size-3.5 text-fg-subtle" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className="z-60 max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] animate-pop overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-card-lg"
        >
          <S.Viewport className="scrollbar-thin">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex min-h-10 cursor-default items-start gap-2.5 rounded-lg py-2 pr-8 pl-2.5 text-sm text-fg outline-none select-none data-disabled:opacity-40 data-highlighted:bg-surface-2"
              >
                {o.icon ? (
                  <span className="mt-0.5 text-fg-muted [&_svg]:size-4">
                    {o.icon}
                  </span>
                ) : null}
                <span className="min-w-0">
                  <S.ItemText>{o.label}</S.ItemText>
                  {o.description ? (
                    <span className="block text-xs text-fg-muted">
                      {o.description}
                    </span>
                  ) : null}
                </span>
                <S.ItemIndicator className="absolute top-2.5 right-2.5 text-accent-text">
                  <CheckIcon className="size-4" strokeWidth={2.5} />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}

export const Select = forwardRef(SelectInner) as <V extends string>(
  props: SelectProps<V> & { ref?: React.ForwardedRef<HTMLButtonElement> },
) => ReturnType<typeof SelectInner>
