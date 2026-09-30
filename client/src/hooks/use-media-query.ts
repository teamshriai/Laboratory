import { useSyncExternalStore } from 'react'

/** Live result of a CSS media query (false during SSR and in tests without matchMedia). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia)
        return () => undefined
      const mql = window.matchMedia(query)
      mql.addEventListener('change', notify)
      return () => mql.removeEventListener('change', notify)
    },
    () =>
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(query).matches
        : false,
    () => false,
  )
}

/** Desktop layout with the full sidebar (≥1024px). */
export const DESKTOP_QUERY = '(min-width: 1024px)'
/** Tablet and up: the icon rail replaces the drawer (≥768px). */
export const RAIL_QUERY = '(min-width: 768px)'
