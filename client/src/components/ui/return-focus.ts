import { useEffect, useRef } from 'react'

const DIALOG = '[role="dialog"], [role="alertdialog"]'

/** Recently focused elements, newest last (a short history is enough). */
const history: HTMLElement[] = []
if (typeof document !== 'undefined')
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const at = history.indexOf(target)
      if (at >= 0) history.splice(at, 1)
      history.push(target)
      if (history.length > 12) history.shift()
    },
    true,
  )

/** Still in the page and shown (not inside a closed or hidden panel). */
function isAvailable(el: HTMLElement | null): el is HTMLElement {
  return Boolean(el?.isConnected && el.getClientRects().length > 0)
}

/**
 * Where focus was before `overlay` opened: the newest focused element that
 * is not inside it. That may be inside a parent dialog or drawer (a dialog
 * opened from a drawer returns to the drawer, not to the page behind it).
 */
function previousFocus(overlay: Element | null) {
  for (let i = history.length - 1; i >= 0; i--) {
    const el = history[i]!
    if (overlay && overlay.contains(el)) continue
    if (isAvailable(el)) return el
  }
  return null
}

/** Focus is free to move: nothing else (such as `main` after a route change) took it. */
function focusIsFree(container: Node | null) {
  const active = document.activeElement
  return (
    active === null ||
    active === document.body ||
    Boolean(container && container.contains(active))
  )
}

/**
 * Radix returns focus only to a `Dialog.Trigger`. Dialogs and drawers opened
 * from state (a button handler, a menu item, a URL parameter) would drop
 * focus to <body> on close, and so would one that unmounts instead of
 * closing. This returns focus to what had it before the overlay opened
 * (WCAG 2.4.3), unless something else has taken focus meanwhile.
 */
export function useReturnFocus(
  open: boolean,
  /** The overlay's own panel: focus inside it is never the way back. */
  content?: { readonly current: Element | null },
) {
  const returnTo = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    // Usually still the element that opened it (Radix moves focus in a later
    // render); else the newest focused element outside this overlay, which
    // may sit in a parent drawer. Without the panel, skip any dialog that
    // holds focus already (the older behaviour).
    const active = document.activeElement
    const overlay =
      content?.current ??
      (active instanceof Element ? active.closest(DIALOG) : null)
    const target = previousFocus(overlay)
    returnTo.current = target
    return () => {
      // Unmounted without a close animation: restore once the DOM settles.
      requestAnimationFrame(() => {
        if (isAvailable(target) && focusIsFree(null))
          target.focus({ preventScroll: true })
      })
    }
  }, [open, content])
  return {
    onCloseAutoFocus: (event: Event) => {
      const target = returnTo.current
      const container = event.target instanceof Node ? event.target : null
      if (isAvailable(target) && focusIsFree(container)) {
        event.preventDefault()
        target.focus({ preventScroll: true })
      }
    },
  }
}

const FIELD =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled])'

/**
 * Where focus goes when a dialog or drawer opens. With a fine pointer
 * (mouse, keyboard) the first form field, so typing can start at once; on
 * touch, the panel itself, so the phone keyboard does not pop up. Never the
 * close button: its tooltip would take the first Escape.
 */
export function focusOnOpen(event: Event) {
  const content = event.currentTarget
  if (!(content instanceof HTMLElement)) return
  event.preventDefault()
  const wanted = content.querySelector<HTMLElement>('[data-autofocus]')
  const coarse =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches
  const field = coarse ? null : content.querySelector<HTMLElement>(FIELD)
  const target = wanted ?? field ?? content
  if (target === content && !content.hasAttribute('tabindex'))
    content.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}
