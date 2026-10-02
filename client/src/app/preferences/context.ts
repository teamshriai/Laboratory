import { createContext, useContext } from 'react'
import type { DepartmentId } from '@/domain/types'

export interface PreferencesState {
  /** Working department: filters queues when set. */
  department: DepartmentId | null
  setDepartment: (d: DepartmentId | null) => void
  /** Staff member recorded on actions (there is no login). */
  actorId: string
  setActorId: (id: string) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  /** Row height of lists and tables; controls keep their 44px size. */
  density: 'compact' | 'comfortable'
  setDensity: (d: 'compact' | 'comfortable') => void
  /** Accessibility: in addition to the operating system setting. */
  reduceMotion: boolean
  setReduceMotion: (on: boolean) => void
  highContrast: boolean
  setHighContrast: (on: boolean) => void
  /** Full-size interface on wide screens (the default is scaled to ~94%). */
  largeInterface: boolean
  setLargeInterface: (on: boolean) => void
}

export const PreferencesContext = createContext<PreferencesState | null>(null)

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx)
    throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
