/**
 * Moves focus to the first field marked invalid inside `root` (or the page),
 * so keyboard and screen-reader users land on what needs fixing.
 */
export function focusFirstInvalid(root?: HTMLElement | null) {
  const el = (root ?? document).querySelector<HTMLElement>(
    '[aria-invalid="true"]',
  )
  if (!el) return
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
