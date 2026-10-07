import {
  BanIcon,
  BikeIcon,
  CalendarPlusIcon,
  CircleCheckIcon,
  CircleXIcon,
  PhoneIcon,
  SearchXIcon,
  SnowflakeIcon,
  TriangleAlertIcon,
  UserCheckIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { HomeVisitRow } from '@/services/lab-api'
import { PatientCell } from '@/components/lab/patient'
import { RecordLink } from '@/components/lab/record-link'
import { buttonVariants } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { Timeline, type TimelineEntry } from '@/components/ui/misc'
import { SkeletonText } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { isOnRoute, isOpenForDesk } from './day'
import { DeskActions, RouteActions } from './visit-actions'
import type { VisitAction } from './visit-dialogs'
import { VisitStateBadge } from './visit-state'

type EventSpec = { icon: ReactNode; tone: TimelineEntry['tone'] }

const EVENTS = {
  'visit-booked': { icon: <CalendarPlusIcon />, tone: 'accent' },
  'visit-assigned': { icon: <UserCheckIcon />, tone: 'neutral' },
  'visit-en-route': { icon: <BikeIcon />, tone: 'accent' },
  'visit-collected': { icon: <CircleCheckIcon />, tone: 'success' },
  'visit-missed': { icon: <CircleXIcon />, tone: 'warning' },
  'visit-cancelled': { icon: <BanIcon />, tone: 'neutral' },
} satisfies Record<string, EventSpec>
type EventType = keyof typeof EVENTS
const isEvent = (type: string): type is EventType => type in EVENTS

export function VisitDrawer({
  visitId,
  visit,
  isLoading,
  isError,
  onRetry,
  onClose,
  onAction,
}: {
  visitId: string
  visit: HomeVisitRow | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onClose: () => void
  onAction: (action: VisitAction, visit: HomeVisitRow) => void
}) {
  const t = useT('homeCollection')
  return (
    <Drawer
      open={Boolean(visitId)}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={visit ? t('detailsTitle', { visitNo: visit.visitNo }) : t('title')}
      headerExtra={visit ? <VisitStateBadge state={visit.state} /> : null}
      footer={
        visit &&
        (isOpenForDesk(visit.state) ||
          (isOnRoute(visit.state) && visit.phlebotomistId)) ? (
          <div className="grid w-full gap-3">
            <RouteActions visit={visit} onAction={onAction} size="md" />
            <DeskActions
              visit={visit}
              onAction={onAction}
              size="sm"
              className="justify-end"
            />
          </div>
        ) : null
      }
    >
      {visit ? (
        <VisitDetails visit={visit} />
      ) : isLoading ? (
        <SkeletonText lines={8} />
      ) : isError ? (
        <ErrorState compact onRetry={onRetry} />
      ) : (
        <EmptyState compact icon={<SearchXIcon />} title={t('visitNotFound')} />
      )}
    </Drawer>
  )
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs text-fg-subtle sm:pt-0.5">{label}</dt>
      <dd className="text-sm break-words text-fg">{children}</dd>
    </div>
  )
}

function VisitDetails({ visit }: { visit: HomeVisitRow }) {
  const t = useT('homeCollection')
  const f = useFormat()
  const history: TimelineEntry[] = visit.history.toReversed().map((h) => {
    const type = h.type
    const spec: EventSpec | undefined = isEvent(type) ? EVENTS[type] : undefined
    return {
      id: h.id,
      title: isEvent(type) ? t(`event.${type}`, h.params ?? {}) : type,
      meta: `${f.dateTime(h.at)}${h.byName ? ` · ${h.byName}` : ''}`,
      icon: spec?.icon,
      tone: spec?.tone ?? 'neutral',
    }
  })
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <PatientCell patient={visit.patient} className="min-w-48 flex-1" />
        {visit.patient.mobile ? (
          <a
            href={`tel:${visit.patient.mobile}`}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            <PhoneIcon />
            {t('call', { mobile: visit.patient.mobile })}
          </a>
        ) : null}
      </div>

      <dl className="grid gap-3">
        <Row label={t('fieldVisitNo')}>
          <span className="font-mono tabular-nums">{visit.visitNo}</span>
        </Row>
        <Row label={t('fieldSlot')}>
          {f.date(visit.slotStart)},{' '}
          {t('slotRange', {
            start: f.time(visit.slotStart),
            end: f.time(visit.slotEnd),
          })}
        </Row>
        <Row label={t('fieldAddress')}>{visit.address}</Row>
        <Row label={t('fieldPin')}>
          <span className="font-mono tabular-nums">{visit.pinCode}</span>
        </Row>
        {visit.landmark ? (
          <Row label={t('fieldLandmark')}>{visit.landmark}</Row>
        ) : null}
        {visit.orderId && visit.orderNo ? (
          <Row label={t('fieldOrder')}>
            <RecordLink kind="order" id={visit.orderId} className="py-0.5">
              {visit.orderNo}
            </RecordLink>
          </Row>
        ) : null}
        <Row label={t('fieldPhlebotomist')}>
          {visit.phlebotomistName ?? (
            <span className="inline-flex items-center gap-1.5 font-medium text-warning-text">
              <TriangleAlertIcon className="size-3.5" aria-hidden />
              {t('unassigned')}
            </span>
          )}
        </Row>
        <Row label={t('fieldBookedBy')}>
          {visit.createdByName} · {f.dateTime(visit.createdAt)}
        </Row>
        {visit.notes ? <Row label={t('fieldNotes')}>{visit.notes}</Row> : null}
        {visit.cancelReason &&
        (visit.state === 'missed' || visit.state === 'cancelled') ? (
          <Row label={t('reasonTitle')}>{visit.cancelReason}</Row>
        ) : null}
      </dl>

      {visit.proof ? (
        <section aria-labelledby="hv-proof">
          <h3 id="hv-proof" className="mb-2 text-sm font-semibold text-fg">
            {t('proofTitle')}
          </h3>
          <dl className="grid gap-3 rounded-xl border border-line bg-surface-2/60 p-4">
            <Row label={t('proofAt')}>{f.dateTime(visit.proof.at)}</Row>
            <Row label={t('proofReceivedBy')}>{visit.proof.receivedBy}</Row>
            <Row label={t('proofColdChain')}>
              <span
                className={
                  visit.proof.coldChain
                    ? 'inline-flex items-center gap-1.5 text-success-text'
                    : 'inline-flex items-center gap-1.5 text-warning-text'
                }
              >
                {visit.proof.coldChain ? (
                  <SnowflakeIcon className="size-3.5" aria-hidden />
                ) : (
                  <TriangleAlertIcon className="size-3.5" aria-hidden />
                )}
                {visit.proof.coldChain
                  ? t('coldChainKept')
                  : t('coldChainBroken')}
              </span>
            </Row>
            {visit.proof.note ? (
              <Row label={t('proofNote')}>{visit.proof.note}</Row>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="hv-history">
        <h3 id="hv-history" className="mb-3 text-sm font-semibold text-fg">
          {t('historyTitle')}
        </h3>
        <Timeline items={history} />
      </section>
    </div>
  )
}
