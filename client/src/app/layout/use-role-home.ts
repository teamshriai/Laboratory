import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useActor } from '@/hooks/use-permission'

/**
 * Switching "acting as" between a referring doctor and lab staff opens that
 * role's home: a doctor's patient list, or the lab dashboard. The first
 * actor after a reload keeps the page they are on. The doctor's view is
 * fetched again for the new person (its answer depends on who asks).
 */
export function useRoleHome() {
  const actor = useActor()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { pathname } = useLocation()
  const actorId = actor?.id ?? null
  const isDoctor = actor ? actor.role === 'doctor' : null
  const last = useRef({ actorId, isDoctor })
  useEffect(() => {
    if (actorId === null || isDoctor === null) return
    const was = last.current
    last.current = { actorId, isDoctor }
    if (was.actorId === null || was.actorId === actorId) return
    void queryClient.invalidateQueries({ queryKey: ['lab', 'doctor'] })
    if (was.isDoctor === isDoctor) return
    if (!isDoctor) void navigate('/dashboard')
    else if (!pathname.startsWith('/my-patients')) void navigate('/my-patients')
  }, [actorId, isDoctor, pathname, navigate, queryClient])
}
