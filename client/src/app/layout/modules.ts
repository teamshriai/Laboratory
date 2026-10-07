import type { ModuleId } from '@/domain/types'
import { useLabSettings } from '@/services/queries'

/** The module each route prefix belongs to (core screens have none). */
export const ROUTE_MODULES: [prefix: string, module: ModuleId][] = [
  ['/billing', 'billing'],
  ['/home-collection', 'homeCollection'],
  ['/messages', 'messaging'],
  ['/imaging', 'imaging'],
  ['/inventory', 'inventory'],
  ['/reagents', 'inventory'],
  ['/consumables', 'inventory'],
  ['/quality', 'quality'],
  ['/cold-storage', 'quality'],
  ['/registers', 'compliance'],
  ['/privacy', 'compliance'],
  ['/interfaces', 'interfaces'],
  ['/my-patients', 'doctorPortal'],
]

export function moduleOfPath(pathname: string): ModuleId | undefined {
  return ROUTE_MODULES.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )?.[1]
}

/** Whether a module is on (everything counts as on until settings load). */
export function useModules() {
  const { data } = useLabSettings()
  return (module: ModuleId | undefined) =>
    !module || !data || data.modules[module] !== false
}
