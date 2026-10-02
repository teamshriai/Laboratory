import { useEffect } from 'react'

/** Quotes text as a CSS string (for `content:` in a page margin box). */
export function cssString(text: string) {
  return `"${text.replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ')}"`
}

/**
 * Adds print-only `@page` rules (running headers and footers in the page
 * margin boxes) while the calling component is mounted. A constructed
 * stylesheet is used, so no inline <style> element is needed (CSP friendly).
 * Browsers without margin-box support simply ignore the rules.
 */
export function usePageRules(css: string | null) {
  useEffect(() => {
    if (
      !css ||
      typeof CSSStyleSheet === 'undefined' ||
      !('adoptedStyleSheets' in document)
    )
      return
    const sheet = new CSSStyleSheet()
    try {
      sheet.replaceSync(css)
    } catch {
      return
    }
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (s) => s !== sheet,
      )
    }
  }, [css])
}
