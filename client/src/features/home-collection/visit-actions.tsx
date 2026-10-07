import {
  BanIcon,
  BikeIcon,
  CircleCheckIcon,
  CircleXIcon,
  UserCheckIcon,
  UserRoundCogIcon,
} from 'lucide-react'
import { usePreferences } from '@/app/preferences/context'
import { useActor } from '@/hooks/use-permission'
import { useT } from '@/i18n/context'
import { demo, labApi, type HomeVisitRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { isOnRoute, isOpenForDesk } from './day'
import type { VisitAction } from './visit-dialogs'

/** The desk's actions on a visit: assign (or reassign) and cancel. */
export function DeskActions({
  visit,
  onAction,
  size = 'xs',
  className,
}: {
  visit: HomeVisitRow
  onAction: (action: VisitAction, visit: HomeVisitRow) => void
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const t = useT('homeCollection')
  if (!isOpenForDesk(visit.state)) return null
  return (
    // Inside a clickable table row: the buttons act, the row does not open.
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      onClick={(ev) => ev.stopPropagation()}
    >
      <GuardedButton
        permission="home.dispatch"
        size={size}
        variant={visit.phlebotomistId ? 'secondary' : 'soft'}
        onClick={() => onAction('assign', visit)}
      >
        {visit.phlebotomistId ? <UserRoundCogIcon /> : <UserCheckIcon />}
        {visit.phlebotomistId ? t('reassign') : t('assign')}
      </GuardedButton>
      <GuardedButton
        permission="home.book"
        size={size}
        variant="ghost"
        onClick={() => onAction('cancel', visit)}
      >
        <BanIcon />
        {t('cancelVisit')}
      </GuardedButton>
    </div>
  )
}

/**
 * The assigned phlebotomist's actions: on the way, collected, missed. Anyone
 * else sees who may act (and, in the demo, can act as them).
 */
export function RouteActions({
  visit,
  onAction,
  size = 'lg',
  className,
}: {
  visit: HomeVisitRow
  onAction: (action: VisitAction, visit: HomeVisitRow) => void
  size?: 'md' | 'lg'
  className?: string
}) {
  const t = useT('homeCollection')
  const actor = useActor()
  const { setActorId } = usePreferences()
  const enRoute = useLabMutation(
    () => labApi.network.updateHomeVisit(visit.id, { state: 'en-route' }),
    { success: () => t('enRouteToast') },
  )
  if (!isOnRoute(visit.state) || !visit.phlebotomistId) return null
  if (actor && actor.id !== visit.phlebotomistId)
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 text-meta text-fg-muted',
          className,
        )}
      >
        <p className="min-w-0 flex-1">
          {t('notYourVisit', { name: visit.phlebotomistName ?? '' })}
        </p>
        {demo.enabled ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActorId(visit.phlebotomistId!)}
          >
            {t('actAs', { name: visit.phlebotomistName ?? '' })}
          </Button>
        ) : null}
      </div>
    )
  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      {visit.state === 'assigned' ? (
        <GuardedButton
          permission="specimen.collect"
          size={size}
          variant="primary"
          className="w-full"
          loading={enRoute.isPending}
          onClick={() => enRoute.mutate(undefined)}
        >
          <BikeIcon />
          {t('onTheWay')}
        </GuardedButton>
      ) : (
        <GuardedButton
          permission="specimen.collect"
          size={size}
          variant="primary"
          className="w-full"
          onClick={() => onAction('collected', visit)}
        >
          <CircleCheckIcon />
          {t('markCollected')}
        </GuardedButton>
      )}
      <GuardedButton
        permission="specimen.collect"
        size={size}
        variant="secondary"
        className="w-full"
        onClick={() => onAction('missed', visit)}
      >
        <CircleXIcon />
        {t('markMissed')}
      </GuardedButton>
    </div>
  )
}
