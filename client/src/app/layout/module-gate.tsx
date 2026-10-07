import { PowerOffIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { EmptyState } from '@/components/ui/states'
import { useT } from '@/i18n/context'
import { moduleOfPath, useModules } from './modules'

/**
 * A screen of a switched-off module shows why instead of its content. The
 * module's data stays untouched; switching it back on restores it.
 */
export function ModuleGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isOn = useModules()
  const t = useT('nav')
  if (isOn(moduleOfPath(pathname))) return children
  return (
    <EmptyState
      icon={<PowerOffIcon />}
      tone="slate"
      title={t('moduleOffTitle')}
      description={t('moduleOffBody')}
    />
  )
}
