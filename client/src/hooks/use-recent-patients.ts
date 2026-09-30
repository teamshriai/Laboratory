import { useCallback } from 'react'
import { usePersistentState } from './use-persistent-state'

export interface RecentPatient {
  id: string
  name: string
  uhid: string
}

export function useRecentPatients() {
  const [recent, setRecent] = usePersistentState<RecentPatient[]>(
    'recent-patients',
    [],
  )
  const remember = useCallback(
    (p: RecentPatient) =>
      setRecent((prev) =>
        [p, ...prev.filter((x) => x.id !== p.id)].slice(0, 6),
      ),
    [setRecent],
  )
  return { recent, remember }
}
