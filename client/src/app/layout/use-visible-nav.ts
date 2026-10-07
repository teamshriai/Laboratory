import { usePermissions } from '@/hooks/use-permission'
import type { NavItem } from './nav-config'
import { useModules } from './modules'

/**
 * Which navigation the acting user sees: items they hold a permission for,
 * and only the doctor's own section for a referring doctor. Hiding a link
 * is a convenience; the API refuses the same people regardless.
 */
export function useVisibleNav() {
  const { actor, can } = usePermissions()
  const isOn = useModules()
  const doctorOnly = actor?.role === 'doctor'
  const visible = (items: NavItem[]) =>
    items.filter(
      (item) => isOn(item.module) && (!item.anyOf || item.anyOf.some(can)),
    )
  return { doctorOnly, visible }
}
