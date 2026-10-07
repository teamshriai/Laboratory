import { LayoutDashboardIcon, StethoscopeIcon } from 'lucide-react'
import { Link } from 'react-router'
import { usePreferences } from '@/app/preferences/context'
import { useActor } from '@/hooks/use-permission'
import { useEnum, useT } from '@/i18n/context'
import { demo } from '@/services/lab-api'
import { useReference } from '@/services/queries'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/states'

/**
 * Shown when the acting user is not a referring doctor (the API refuses
 * them). In the demo it offers to act as one of the doctors instead; this is
 * the role switcher standing in for a login, not a security boundary.
 */
export function DoctorOnlyNotice() {
  const t = useT('doctorPortal')
  const e = useEnum()
  const actor = useActor()
  const { setActorId } = usePreferences()
  const { data: reference } = useReference()
  const doctors = (reference?.staff ?? []).filter((s) => s.role === 'doctor')
  return (
    <Card>
      <div role="alert">
        <EmptyState
          icon={<StethoscopeIcon />}
          tone="amber"
          title={t('notDoctorTitle')}
          description={
            <>
              {actor
                ? t('notDoctorBody', {
                    name: actor.name,
                    role: e('staffRole', actor.role),
                  })
                : null}{' '}
              {t('notDoctorHint')}
            </>
          }
          action={
            <>
              {demo.enabled
                ? doctors.map((d) => (
                    <Button
                      key={d.id}
                      variant="primary"
                      onClick={() => setActorId(d.id)}
                    >
                      <StethoscopeIcon />
                      {t('actAs', { name: d.name })}
                    </Button>
                  ))
                : null}
              <Link
                to="/dashboard"
                className={buttonVariants({ variant: 'secondary' })}
              >
                <LayoutDashboardIcon />
                {t('goDashboard')}
              </Link>
            </>
          }
        />
      </div>
    </Card>
  )
}
