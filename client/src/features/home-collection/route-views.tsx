import {
  CircleCheckIcon,
  MapPinIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  RouteIcon,
  SnowflakeIcon,
  TriangleAlertIcon,
  UserCheckIcon,
} from 'lucide-react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { HomeVisitList, HomeVisitRow } from '@/services/lab-api'
import { GuardedButton } from '@/components/lab/guarded-button'
import { PatientCell } from '@/components/lab/patient'
import { RecordLink } from '@/components/lab/record-link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { isDone } from './day'
import { RouteActions } from './visit-actions'
import type { VisitAction } from './visit-dialogs'
import { VisitStateBadge } from './visit-state'

type OnAction = (action: VisitAction, visit: HomeVisitRow) => void

/** The day's routes beside the desk table, with unassigned visits first. */
export function RoutesPanel({
  list,
  onOpen,
  onAction,
}: {
  list: HomeVisitList
  onOpen: (id: string) => void
  onAction: OnAction
}) {
  const t = useT('homeCollection')
  const f = useFormat()
  const byId = new Map(list.rows.map((r) => [r.id, r]))
  const unassigned = list.rows.filter((r) => r.state === 'booked')
  return (
    <Card>
      <CardHeader
        title={t('routesTitle')}
        description={t('routesHint')}
        icon={<RouteIcon />}
        tone="rose"
      />
      <div className="grid gap-5 px-4 pb-4 sm:px-5 sm:pb-5">
        {unassigned.length ? (
          <section
            aria-labelledby="hv-unassigned"
            className="rounded-xl border border-warning-text/25 bg-warning-soft p-3.5"
          >
            <h3
              id="hv-unassigned"
              className="flex items-center gap-2 text-sm font-semibold text-warning-text"
            >
              <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
              {t('unassignedTitle')}
            </h3>
            <p className="mt-0.5 text-xs text-warning-text">
              {t('unassignedCount', { count: unassigned.length })}
            </p>
            <ul className="mt-3 grid gap-2">
              {unassigned.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2.5"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(v.id)}
                    className="focus-ring min-h-11 min-w-0 flex-1 rounded-md text-left"
                  >
                    <span className="block text-meta font-semibold text-fg tabular-nums">
                      {f.time(v.slotStart)} · {t('pin', { pin: v.pinCode })}
                    </span>
                    <span className="block truncate text-xs text-fg-muted">
                      {v.patient.name}
                    </span>
                  </button>
                  <GuardedButton
                    permission="home.dispatch"
                    size="xs"
                    variant="soft"
                    onClick={() => onAction('assign', v)}
                  >
                    <UserCheckIcon />
                    {t('assign')}
                  </GuardedButton>
                </li>
              ))}
            </ul>
          </section>
        ) : list.rows.length ? (
          <p className="flex items-center gap-2 text-meta text-success-text">
            <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
            {t('allAssigned')}
          </p>
        ) : null}

        {list.routes.length === 0 ? (
          <p className="text-meta text-fg-muted">{t('noRoutes')}</p>
        ) : (
          list.routes.map((route) => {
            const visits = route.visits
              .map((id) => byId.get(id))
              .filter((v): v is HomeVisitRow => Boolean(v))
            const done = visits.filter((v) => isDone(v.state)).length
            return (
              <section key={route.staffId} aria-label={route.name}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="text-sm font-semibold text-fg">
                    {route.name}
                  </h3>
                  <span className="text-xs text-fg-muted tabular-nums">
                    {t('routeProgress', { done, total: visits.length })}
                  </span>
                </div>
                <ol className="relative grid gap-1 border-l border-line pl-3">
                  {visits.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(v.id)}
                        className="focus-ring flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                      >
                        <span className="w-16 shrink-0 text-meta font-semibold text-fg tabular-nums">
                          {f.time(v.slotStart)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-meta text-fg">
                            {v.patient.name}
                          </span>
                          <span className="block font-mono text-xs text-fg-muted tabular-nums">
                            {t('pin', { pin: v.pinCode })}
                          </span>
                        </span>
                        <VisitStateBadge state={v.state} />
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )
          })
        )}
      </div>
    </Card>
  )
}

/** One phlebotomist's visits as large cards, phone first, in slot order. */
export function RouteBoard({
  visits,
  name,
  onOpen,
  onAction,
}: {
  visits: HomeVisitRow[]
  name: string
  onOpen: (id: string) => void
  onAction: OnAction
}) {
  const t = useT('homeCollection')
  if (visits.length === 0)
    return (
      <Card>
        <EmptyState
          icon={<RouteIcon />}
          tone="rose"
          title={t('routeEmptyTitle')}
          description={t('routeEmptyBody', { name })}
        />
      </Card>
    )
  return (
    <ol className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {visits.map((v) => (
        <li key={v.id} className="min-w-0">
          <VisitCard visit={v} onOpen={onOpen} onAction={onAction} />
        </li>
      ))}
    </ol>
  )
}

function VisitCard({
  visit,
  onOpen,
  onAction,
}: {
  visit: HomeVisitRow
  onOpen: (id: string) => void
  onAction: OnAction
}) {
  const t = useT('homeCollection')
  const f = useFormat()
  const done = isDone(visit.state)
  return (
    <Card
      className={cn(
        'flex h-full flex-col gap-4 p-4 sm:p-5',
        done && 'bg-surface-2/60',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg leading-tight font-semibold text-fg tabular-nums">
            {t('slotRange', {
              start: f.time(visit.slotStart),
              end: f.time(visit.slotEnd),
            })}
          </p>
          <button
            type="button"
            onClick={() => onOpen(visit.id)}
            className="focus-ring mt-0.5 inline-flex min-h-6 items-center rounded-sm font-mono text-xs text-fg-muted tabular-nums underline-offset-2 hover:text-accent-text hover:underline"
          >
            {visit.visitNo}
          </button>
        </div>
        <VisitStateBadge state={visit.state} size="md" />
      </div>

      <PatientCell patient={visit.patient} showLocal={false} />

      <div className="flex items-start gap-2.5 text-sm text-fg">
        <MapPinIcon
          className="mt-0.5 size-4 shrink-0 text-ic-rose"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="break-words">{visit.address}</p>
          {visit.landmark ? (
            <p className="mt-0.5 text-meta text-fg-muted">
              {t('near', { landmark: visit.landmark })}
            </p>
          ) : null}
          <p className="mt-0.5 font-mono text-meta font-semibold text-fg tabular-nums">
            {t('pin', { pin: visit.pinCode })}
          </p>
        </div>
      </div>

      {visit.notes ? (
        <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-meta text-info-text">
          <MessageSquareTextIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <span className="min-w-0 break-words">{visit.notes}</span>
        </p>
      ) : null}

      {visit.orderId && visit.orderNo ? (
        <p className="text-meta text-fg-muted">
          {t('fieldOrder')}:{' '}
          <RecordLink kind="order" id={visit.orderId} className="py-0.5">
            {visit.orderNo}
          </RecordLink>
        </p>
      ) : null}

      {visit.proof ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-fg-muted">
          <span>
            {t('proofReceivedBy')}: {visit.proof.receivedBy} ·{' '}
            {f.time(visit.proof.at)}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1',
              visit.proof.coldChain ? 'text-success-text' : 'text-warning-text',
            )}
          >
            {visit.proof.coldChain ? (
              <SnowflakeIcon className="size-3.5" aria-hidden />
            ) : (
              <TriangleAlertIcon className="size-3.5" aria-hidden />
            )}
            {visit.proof.coldChain ? t('coldChainKept') : t('coldChainBroken')}
          </span>
        </p>
      ) : null}
      {visit.cancelReason &&
      (visit.state === 'missed' || visit.state === 'cancelled') ? (
        <p className="text-meta text-fg-muted">
          {t('reasonTitle')}: {visit.cancelReason}
        </p>
      ) : null}

      {!done ? (
        <div className="mt-auto grid gap-2 pt-1">
          {visit.patient.mobile ? (
            <a
              href={`tel:${visit.patient.mobile}`}
              className={buttonVariants({
                variant: 'secondary',
                size: 'lg',
                className: 'w-full',
              })}
            >
              <PhoneIcon />
              {t('call', { mobile: visit.patient.mobile })}
            </a>
          ) : null}
          <RouteActions visit={visit} onAction={onAction} />
        </div>
      ) : null}
    </Card>
  )
}
