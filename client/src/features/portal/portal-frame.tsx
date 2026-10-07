import type { ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { INDOSTATES } from '@/lib/brand'
import type { PublicLab } from '@/services/lab-api'
import { IndostatesLogo, Logo } from '@/components/ui/logo'

/** Header and footer of the public pages (shared report, verification). */
export function PortalFrame({
  lab,
  actions,
  children,
}: {
  lab?: Pick<PublicLab, 'labName'> | undefined
  actions?: ReactNode
  children: ReactNode
}) {
  const t = useT('portal')
  return (
    <div className="min-h-dvh bg-surface-2 text-fg">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Logo className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-wide text-fg">
                {lab?.labName ?? 'SHRI HEALTH'}
              </p>
              <p className="truncate text-xs text-fg-muted">{t('brandLine')}</p>
            </div>
          </div>
          <IndostatesLogo
            alt={INDOSTATES.name}
            className="hidden h-8 rounded-md sm:block"
          />
          {actions}
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-4 px-3 py-5 sm:px-6 sm:py-8">
        {children}
        <p className="text-center text-xs text-fg-subtle print:hidden">
          {t('disclaimer')}
        </p>
      </main>
    </div>
  )
}
