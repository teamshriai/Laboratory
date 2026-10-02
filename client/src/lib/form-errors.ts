import type { FieldErrors } from 'react-hook-form'
import { focusFirstInvalid } from './focus'

/** How many fields have an error (nested and array fields included). */
export function countFieldErrors(errors: FieldErrors): number {
  let n = 0
  for (const value of Object.values(errors)) {
    if (!value || typeof value !== 'object') continue
    if ('message' in value && typeof value.message === 'string') n += 1
    else n += countFieldErrors(value as FieldErrors)
  }
  return n
}

/** `handleSubmit(onValid, focusInvalid)`: lands on the first field to fix. */
export const focusInvalid = () =>
  void window.setTimeout(() => focusFirstInvalid(), 0)
