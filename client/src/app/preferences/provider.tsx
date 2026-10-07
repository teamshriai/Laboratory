import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { DEPARTMENTS, type DepartmentId } from '@/domain/types'
import { oneOf } from '@/lib/storage'
import { usePersistentState } from '@/hooks/use-persistent-state'
import { demo } from '@/services/lab-api'
import { useSession } from '@/services/queries'
import { PreferencesContext } from './context'

const isDepartment = oneOf<DepartmentId | null>([...DEPARTMENTS, null])
const isDensity = oneOf(['compact', 'comfortable'] as const)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [department, setDepartment] = usePersistentState<DepartmentId | null>(
    'department',
    null,
    isDepartment,
  )
  const [storedActorId, setActorState] = usePersistentState<string>(
    'acting-as',
    demo.getActor(),
  )
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>(
    'sidebar-collapsed',
    false,
  )
  const [density, setDensity] = usePersistentState<'compact' | 'comfortable'>(
    'density',
    'compact',
    isDensity,
  )
  const [reduceMotion, setReduceMotion] = usePersistentState<boolean>(
    'reduce-motion',
    false,
  )
  const [highContrast, setHighContrast] = usePersistentState<boolean>(
    'high-contrast',
    false,
  )
  const [largeInterface, setLargeInterface] = usePersistentState<boolean>(
    'large-ui',
    false,
  )
  // Applied on <html> so every screen, dialog and portal follows them.
  useEffect(() => {
    const root = document.documentElement
    root.toggleAttribute('data-reduce-motion', reduceMotion)
    root.toggleAttribute('data-high-contrast', highContrast)
    root.toggleAttribute('data-large-ui', largeInterface)
  }, [reduceMotion, highContrast, largeInterface])

  // The demo acts as any member of staff; with a backend the signed-in
  // user is always the actor and cannot be switched here.
  const session = useSession(!demo.enabled)
  const actorId = demo.enabled ? storedActorId : (session.data?.staffId ?? '')
  const setActorId = useCallback(
    (id: string) => {
      if (!demo.enabled) return
      demo.setActor(id)
      setActorState(id)
    },
    [setActorState],
  )

  const value = useMemo(
    () => ({
      department,
      setDepartment,
      actorId,
      setActorId,
      sidebarCollapsed,
      setSidebarCollapsed,
      density,
      setDensity,
      reduceMotion,
      setReduceMotion,
      highContrast,
      setHighContrast,
      largeInterface,
      setLargeInterface,
    }),
    [
      department,
      setDepartment,
      actorId,
      setActorId,
      sidebarCollapsed,
      setSidebarCollapsed,
      density,
      setDensity,
      reduceMotion,
      setReduceMotion,
      highContrast,
      setHighContrast,
      largeInterface,
      setLargeInterface,
    ],
  )
  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}
