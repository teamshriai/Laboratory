/** A key press meant for a text field, not for a page shortcut. */
export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.isContentEditable ||
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="textbox"]',
    ),
  )
}

/** A dialog, drawer, menu or list box is open: shortcuts stay out of it. */
export function isOverlayOpen() {
  return Boolean(
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
    ),
  )
}

/**
 * The visible rows' open buttons, in order. The table and its phone layout
 * are both in the page; only the one on screen has boxes.
 */
export function rowOpenButtons(root: HTMLElement) {
  return [
    ...root.querySelectorAll<HTMLButtonElement>('[data-row-open]'),
  ].filter((b) => b.getClientRects().length > 0)
}
