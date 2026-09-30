import { useEffect, useRef } from 'react'

/** The last element focused outside any dialog: where focus goes back to. */
let lastOutside: HTMLElement | null = null
if (typeof document !== 'undefined')
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        !target.closest('[role="dialog"], [role="alertdialog"]')
      )
        lastOutside = target
    },
    true,
  )

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
export function useReturnFocus(open: boolean) {
  const returnTo = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    const target = lastOutside
    returnTo.current = target
    return () => {
      // Unmounted without a close animation: restore once the DOM settles.
      requestAnimationFrame(() => {
        if (target?.isConnected && focusIsFree(null))
          target.focus({ preventScroll: true })
      })
    }
  }, [open])
  return {
    onCloseAutoFocus: (event: Event) => {
      const target = returnTo.current
      const container = event.target instanceof Node ? event.target : null
      if (target?.isConnected && focusIsFree(container)) {
        event.preventDefault()
        target.focus({ preventScroll: true })
      }
    },
  }
}
