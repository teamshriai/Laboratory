import { LogInIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { isApiError } from '@/domain/errors'
import { useT } from '@/i18n/context'
import { signInHref } from '@/lib/session-links'
import { demo } from '@/services/lab-api'
import { useSession } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { EmptyState, ErrorState } from '@/components/ui/states'

/**
 * With a real backend the app opens only for a signed-in session; the
 * server decides who that is and what they may do. The demo has no login,
 * so it passes straight through.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  if (!demo.enabled) return <BackendSession>{children}</BackendSession>
  return children
}

function BackendSession({ children }: { children: ReactNode }) {
  const t = useT('common')
  const session = useSession()
  if (session.isSuccess) return children
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="mb-4 flex justify-center">
          <Logo />
        </div>
        {session.isPending ? (
          <p role="status" className="py-6 text-center text-sm text-fg-muted">
            {t('sessionChecking')}
          </p>
        ) : isApiError(session.error) &&
          session.error.code === 'unauthenticated' ? (
          <EmptyState
            icon={<LogInIcon />}
            title={t('sessionEndedTitle')}
            description={t('sessionEndedBody')}
            action={
              <Button asChild variant="primary">
                <a href={signInHref()}>{t('signIn')}</a>
              </Button>
            }
          />
        ) : (
          <ErrorState onRetry={() => void session.refetch()} />
        )}
      </div>
    </main>
  )
}
