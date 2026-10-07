// Unsaved work across the settings page: each section reports whether it
// has changes, and one guard (one router blocker) asks before leaving.

import { createContext, useContext, useEffect } from 'react'

export interface DirtyStore {
  set: (key: string, dirty: boolean) => void
  subscribe: (listener: () => void) => () => void
  get: () => boolean
}

export function createDirtyStore(): DirtyStore {
  const dirty = new Set<string>()
  const listeners = new Set<() => void>()
  let snapshot = false
  return {
    set(key, on) {
      if (on) dirty.add(key)
      else dirty.delete(key)
      const next = dirty.size > 0
      if (next === snapshot) return
      snapshot = next
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get: () => snapshot,
  }
}

export const SettingsDirtyContext = createContext<DirtyStore | null>(null)

/** Tells the page this section has unsaved changes (cleared on unmount). */
export function useReportDirty(key: string, dirty: boolean) {
  const store = useContext(SettingsDirtyContext)
  useEffect(() => {
    store?.set(key, dirty)
    return () => store?.set(key, false)
  }, [store, key, dirty])
}
