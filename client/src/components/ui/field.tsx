import { Label } from 'radix-ui'
import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useLanguage } from '@/i18n/context'
import { translate } from '@/i18n/core'
import { cn } from '@/lib/cn'
import { FieldContext } from './field-context'

/** Resolves "forms.required" style error keys through i18n; plain text passes through. */
export function useErrorText(message: string | undefined) {
  const { language } = useLanguage()
  if (!message) return undefined
  if (message.startsWith('forms.'))
    return translate(language, 'forms', message.slice(6))
  if (message.startsWith('errors.'))
    return translate(language, 'errors', message.slice(7))
  return message
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  optionalLabel?: string
  className?: string
  children: ReactElement<{
    id?: string
    'aria-invalid'?: boolean
    'aria-describedby'?: string
  }>
}

/** Label above the control, hint and error below, all wired for screen readers. */
export function Field({
  label,
  hint,
  error,
  required,
  optionalLabel,
  className,
  children,
}: FieldProps) {
  const id = useId()
  const errorText = useErrorText(error)
  // The hint gives way to the error, so only what is shown is referenced.
  const hintId = hint && !errorText ? `${id}-hint` : undefined
  const errorId = errorText ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        'aria-invalid': errorText ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children
  const controlId = isValidElement(children) ? (children.props.id ?? id) : id
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label.Root
        htmlFor={children.props.id ?? id}
        className="flex items-baseline gap-1 text-sm font-medium text-fg-muted"
      >
        {label}
        {required ? (
          <span className="text-danger-text" aria-hidden>
            *
          </span>
        ) : null}
        {!required && optionalLabel ? (
          <span className="text-xs font-normal text-fg-subtle">
            {optionalLabel}
          </span>
        ) : null}
      </Label.Root>
      <FieldContext.Provider
        value={
          // A plain element (a div) already took the id above; only a
          // component that may not pass props on (a Controller) needs this.
          isValidElement(children) && typeof children.type !== 'string'
            ? {
                id: controlId,
                'aria-invalid': errorText ? true : undefined,
                'aria-describedby': describedBy,
              }
            : null
        }
      >
        {control}
      </FieldContext.Provider>
      {hint && !errorText ? (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {errorText ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-danger-text"
        >
          {errorText}
        </p>
      ) : null}
    </div>
  )
}
