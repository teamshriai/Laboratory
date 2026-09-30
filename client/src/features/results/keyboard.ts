import type { KeyboardEvent } from 'react'

const FIELDS = '[data-entry-field], [data-entry-group]'
const FOCUSABLE =
  'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Moves focus to the result field after `from`. A field is an input marked
 * `data-entry-field`, or a `data-entry-group` wrapper (dropdown, toggle
 * group) whose first focusable control takes the focus.
 */
export function focusNextField(from: Element | null) {
  if (!from) return false
  const fields = [...document.querySelectorAll<HTMLElement>(FIELDS)]
  const current = from.closest<HTMLElement>(FIELDS)
  const index = current ? fields.indexOf(current) : -1
  for (const next of fields.slice(index + 1)) {
    const target = next.matches(FOCUSABLE)
      ? next
      : next.querySelector<HTMLElement>(
          '[data-state="on"], [aria-checked="true"], ' + FOCUSABLE,
        )
    if (target) {
      target.focus()
      return true
    }
  }
  return false
}

/** Enter moves to the next result field (Shift+Enter keeps a newline). */
export function nextFieldOnEnter(ev: KeyboardEvent<HTMLElement>) {
  if (ev.key !== 'Enter' || ev.shiftKey || ev.ctrlKey || ev.metaKey) return
  if (focusNextField(ev.currentTarget)) ev.preventDefault()
}
