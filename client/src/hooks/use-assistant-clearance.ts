import { useEffect } from 'react'

/**
 * Lifts the Lab Assistant launcher above a page's sticky bottom action bar
 * (result entry) so it never covers Submit.
 */
export function useAssistantClearance(px: number) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--fab-clearance', `${px}px`)
    return () => {
      root.style.removeProperty('--fab-clearance')
    }
  }, [px])
}
