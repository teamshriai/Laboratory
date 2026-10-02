import { useEffect } from 'react'
import { useBlocker } from 'react-router'

/**
 * Guards unsaved work: in-app navigation waits for confirmation (render
 * `UnsavedChangesDialog` with the returned blocker), and closing or reloading
 * the tab asks the browser's own question. `skip` is read at navigation time,
 * for example once the work has just been saved.
 */
export function useUnsavedChanges(dirty: boolean, skip?: () => boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !skip?.() && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (ev: BeforeUnloadEvent) => ev.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
  return blocker
}
