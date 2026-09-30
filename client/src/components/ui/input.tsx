import { SearchIcon, XIcon } from 'lucide-react'
import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

export const controlClass =
  'w-full rounded-lg border border-line-strong bg-surface text-sm text-fg transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle hover:border-fg-subtle focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus/30 focus-visible:outline-none aria-invalid:border-danger-text aria-invalid:focus-visible:ring-danger-text/35 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-muted'

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(controlClass, 'h-11 px-3.5', className)}
      {...props}
    />
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        controlClass,
        'min-h-20 resize-y px-3.5 py-2.5 leading-relaxed',
        className,
      )}
      {...props}
    />
  )
})

interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange'
> {
  value: string
  onValueChange: (value: string) => void
  clearLabel?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { value, onValueChange, className, clearLabel = 'Clear search', ...props },
    ref,
  ) {
    return (
      <div className={cn('group relative', className)}>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-subtle transition-colors group-focus-within:text-accent-text" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={cn(
            controlClass,
            'h-11 pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden',
          )}
          {...props}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onValueChange('')}
            aria-label={clearLabel}
            className="tap-reach absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
    )
  },
)
