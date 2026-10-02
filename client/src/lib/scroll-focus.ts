/**
 * Ref callback for a scroll box: it takes a tab stop only while its content
 * overflows, so keyboard users can scroll it (WCAG 2.1.1) without an extra
 * stop on boxes that fit.
 */
export function focusWhenScrollable(el: HTMLElement | null) {
  if (!el) return
  const update = () => {
    const scrolls =
      el.scrollWidth > el.clientWidth + 1 ||
      el.scrollHeight > el.clientHeight + 1
    if (scrolls) el.tabIndex = 0
    else el.removeAttribute('tabindex')
  }
  update()
  const observer = new ResizeObserver(update)
  observer.observe(el)
  for (const child of Array.from(el.children)) observer.observe(child)
  return () => observer.disconnect()
}
