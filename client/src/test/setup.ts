import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are off, so Testing Library can't register its own cleanup.
afterEach(() => {
  cleanup()
})

// jsdom lacks a few browser APIs the app shell and charts use.
if (typeof window !== 'undefined') {
  if (typeof (window as { matchMedia?: unknown }).matchMedia !== 'function')
    Object.defineProperty(window, 'matchMedia', {
      value: (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    })
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  if (
    typeof (Element.prototype as { scrollIntoView?: unknown })
      .scrollIntoView !== 'function'
  )
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: () => undefined,
    })
}
