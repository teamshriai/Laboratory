import { usePreferences } from '@/app/preferences/context'
import { hasPermission, rolesWith, type Permission } from '@/domain/permissions'
import { useEnum, useT } from '@/i18n/context'
import { useReference } from '@/services/queries'

/** The staff member the app is acting as (there is no login). */
export function useActor() {
  const { actorId } = usePreferences()
  const { data } = useReference()
  return data?.staff.find((s) => s.id === actorId)
}

/**
 * What the acting user may do, mirroring the engine's checks so actions can
 * be disabled with the reason before anyone tries them. The engine still
 * enforces every rule.
 */
export function usePermissions() {
  const actor = useActor()
  const e = useEnum()
  const te = useT('errors')
  const can = (permission: Permission) => hasPermission(actor, permission)
  const why = (permission: Permission) =>
    !actor || can(permission)
      ? ''
      : te('not-permitted', {
          name: actor.name,
          role: e('staffRole', actor.role),
          action: e('permission', permission),
          roles: rolesWith(permission)
            .map((r) => e('staffRole', r))
            .join(', '),
        })
  return { actor, can, why }
}
