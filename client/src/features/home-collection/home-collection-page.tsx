import {
  HouseIcon,
  ListIcon,
  PlusIcon,
  RouteIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { istDay } from '@/domain/time'
import { HOME_VISIT_STATES, type HomeVisitState } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { usePermissions } from '@/hooks/use-permission'
import {
  useOverlayParam,
  useSearchParam,
  useUrlFilters,
} from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { HomeVisitRow } from '@/services/lab-api'
import { useHomeVisits, useReference } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { FilterBar } from '@/components/lab/filter-bar'
import { GuardedButton } from '@/components/lab/guarded-button'
import { PatientCell } from '@/components/lab/patient'
import { RecordLink } from '@/components/lab/record-link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { CardSkeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FilterTabs, Segmented } from '@/components/ui/toggles'
import { BookVisitDialog } from './book-visit-dialog'
import { dayStart, isDayKey } from './day'
import { DayNav } from './day-nav'
import { RouteBoard, RoutesPanel } from './route-views'
import { DeskActions } from './visit-actions'
import {
  VisitDialogs,
  type VisitAction,
  type VisitTarget,
} from './visit-dialogs'
import { VisitDrawer } from './visit-drawer'
import { VisitStateBadge } from './visit-state'

const VIEWS = ['desk', 'route'] as const
type View = (typeof VIEWS)[number]
/** The phlebotomist filter's value for visits nobody is assigned to yet. */
const UNASSIGNED = 'none'

export function Component() {
  const t = useT('homeCollection')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const { actor } = usePermissions()
  const today = istDay(now)
  const isPhlebotomist = actor?.role === 'phlebotomist'

  // Day, state and phlebotomist live in the URL; an empty day is today.
  const url = useUrlFilters(
    { day: '', state: 'all', staff: '' },
    { state: ['all', ...HOME_VISIT_STATES] },
  )
  const day = isDayKey(url.values.day) ? url.values.day : today
  const state = url.values.state as HomeVisitState | 'all'
  const staffParam = url.values.staff
  const setDay = (d: string) => url.set({ day: d === today ? '' : d })

  // A phlebotomist starts on their own route; the desk on the day's list.
  const [view, setView] = useSearchParam<View>(
    'view',
    isPhlebotomist ? 'route' : 'desk',
    VIEWS,
  )
  const [visitId, openVisit, closeVisit] = useOverlayParam('visit')
  // ?new=1 opens the booking dialog (the button and the command palette).
  const [newParam, openNew, closeNew] = useOverlayParam('new')
  const booking = newParam === '1'
  const setBooking = (open: boolean) => (open ? openNew('1') : closeNew())
  const [, setParams] = useSearchParams()
  // One URL update: two in a row would each start from the same old URL.
  // The day's list takes the dialog's history entry, so Back does not reopen
  // the booking form.
  const onBooked = (booked: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('new')
        if (booked === today) next.delete('day')
        else next.set('day', booked)
        return next
      },
      { replace: true },
    )
  }
  const [target, setTarget] = useState<VisitTarget | null>(null)
  const onAction = (action: VisitAction, visit: HomeVisitRow) =>
    setTarget({ action, visit })

  const { data, isPending, isError, refetch } = useHomeVisits({ day })
  const { data: reference } = useReference()
  const phlebotomists = useMemo(
    () =>
      (reference?.staff ?? [])
        .filter((s) => s.role === 'phlebotomist')
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    [reference],
  )
  const load = new Map(
    (data?.routes ?? []).map((r) => [r.staffId, r.visits.length]),
  )

  const deskRows = data?.rows.filter(
    (r) =>
      (state === 'all' || r.state === state) &&
      (!staffParam ||
        (staffParam === UNASSIGNED
          ? !r.phlebotomistId
          : r.phlebotomistId === staffParam)),
  )

  const routeStaffId = phlebotomists.some((p) => p.id === staffParam)
    ? staffParam
    : isPhlebotomist
      ? actor.id
      : (data?.routes[0]?.staffId ?? phlebotomists[0]?.id ?? '')
  const routeStaff = phlebotomists.find((p) => p.id === routeStaffId)
  const routeVisits = (data?.rows ?? []).filter(
    (r) => r.phlebotomistId === routeStaffId && r.state !== 'cancelled',
  )

  const columns = useMemo<Column<HomeVisitRow>[]>(
    () => [
      {
        id: 'slot',
        header: t('colSlot'),
        sortValue: (r) => r.slotStart,
        cell: (r) => (
          <div className="min-w-0">
            <p className="text-meta font-semibold whitespace-nowrap text-fg tabular-nums">
              {t('slotRange', {
                start: f.time(r.slotStart),
                end: f.time(r.slotEnd),
              })}
            </p>
            <p className="font-mono text-xs whitespace-nowrap text-fg-muted tabular-nums">
              {r.visitNo}
            </p>
          </div>
        ),
      },
      {
        id: 'patient',
        header: t('colPatient'),
        sortValue: (r) => r.patient.name,
        cell: (r) => <PatientCell patient={r.patient} showLocal={false} />,
      },
      {
        id: 'address',
        header: t('colAddress'),
        cell: (r) => (
          <div className="max-w-64 min-w-40">
            <p className="line-clamp-2 text-meta text-fg">{r.address}</p>
            <p className="text-xs text-fg-muted">
              <span className="font-mono tabular-nums">
                {t('pin', { pin: r.pinCode })}
              </span>
              {r.landmark ? ` · ${t('near', { landmark: r.landmark })}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'order',
        header: t('fieldOrder'),
        tabletHidden: true,
        cell: (r) =>
          r.orderId && r.orderNo ? (
            <RecordLink kind="order" id={r.orderId} className="py-0.5 text-xs">
              {r.orderNo}
            </RecordLink>
          ) : null,
      },
      {
        id: 'phlebotomist',
        header: t('colPhlebotomist'),
        sortValue: (r) => r.phlebotomistName ?? '',
        cell: (r) =>
          r.phlebotomistName ? (
            <span className="text-meta whitespace-nowrap text-fg">
              {r.phlebotomistName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap text-warning-text">
              <TriangleAlertIcon className="size-3.5" aria-hidden />
              {t('unassigned')}
            </span>
          ),
      },
      {
        id: 'state',
        header: t('colState'),
        sortValue: (r) => HOME_VISIT_STATES.indexOf(r.state),
        cell: (r) => <VisitStateBadge state={r.state} />,
      },
      {
        id: 'actions',
        header: <span className="sr-only">{tc('actions')}</span>,
        cell: (r) => (
          <DeskActions
            visit={r}
            onAction={(action, visit) => setTarget({ action, visit })}
            className="flex-nowrap justify-end"
          />
        ),
      },
    ],
    [t, tc, f],
  )

  const tabs = [
    { value: 'all' as const, label: t('tabAll'), count: data?.counts.all },
    ...HOME_VISIT_STATES.map((s) => ({
      value: s,
      label: e('homeVisitState', s),
      count: data?.counts[s],
    })),
  ]
  const filtered = state !== 'all' || Boolean(staffParam)
  const bookButton = (
    <GuardedButton
      permission="home.book"
      variant="primary"
      onClick={() => setBooking(true)}
    >
      <PlusIcon strokeWidth={2.5} />
      {t('book')}
    </GuardedButton>
  )

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          <>
            <span>{f.weekday(dayStart(day))}</span>
            {data ? (
              <span>{t('metaCount', { count: data.counts.all })}</span>
            ) : null}
          </>
        }
        actions={bookButton}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DayNav day={day} today={today} onChange={setDay} />
        <Segmented
          aria-label={t('viewLabel')}
          value={view}
          onValueChange={(v) => setView(v)}
          options={[
            { value: 'desk', label: t('viewDesk'), icon: <ListIcon /> },
            {
              value: 'route',
              label:
                isPhlebotomist && routeStaffId === actor.id
                  ? t('myRoute')
                  : t('viewRoute'),
              icon: <RouteIcon />,
            },
          ]}
        />
      </div>

      {view === 'desk' ? (
        <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-3 pt-1">
              <FilterTabs
                value={state}
                onValueChange={(v) => url.set({ state: v })}
                items={tabs}
                aria-label={t('filterState')}
              />
            </div>
            <FilterBar
              canClear={filtered}
              onClear={() => url.set({ state: 'all', staff: '' })}
            >
              <Select
                size="sm"
                aria-label={t('filterPhlebotomist')}
                value={staffParam || 'any'}
                onValueChange={(v) => url.set({ staff: v === 'any' ? '' : v })}
                options={[
                  { value: 'any', label: t('anyPhlebotomist') },
                  { value: UNASSIGNED, label: t('unassigned') },
                  ...phlebotomists.map((p) => ({ value: p.id, label: p.name })),
                ]}
                className="w-52"
              />
            </FilterBar>
            <div className="border-t border-line">
              <DataTable
                caption={t('title')}
                columns={columns}
                rows={deskRows}
                getRowId={(r) => r.id}
                rowLabel={(r) => `${r.visitNo} ${r.patient.name}`}
                onRowClick={(r) => openVisit(r.id)}
                activeRowId={visitId}
                rowClassName={(r) =>
                  r.state === 'booked' ? 'row-alert' : undefined
                }
                isLoading={isPending}
                isError={isError}
                onRetry={() => void refetch()}
                initialSort={{ id: 'slot' }}
                pageSize={50}
                minWidth={960}
                mobile={{
                  primary: 'patient',
                  fields: ['slot', 'state', 'phlebotomist'],
                  actions: 'actions',
                }}
                empty={
                  filtered ? (
                    <EmptyState
                      icon={<HouseIcon />}
                      tone="rose"
                      title={t('emptyFilteredTitle')}
                      description={t('emptyFilteredBody')}
                      action={
                        <Button
                          onClick={() => url.set({ state: 'all', staff: '' })}
                        >
                          {tc('clearFilters')}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={<HouseIcon />}
                      tone="rose"
                      title={t('emptyTitle')}
                      description={t('emptyBody')}
                      action={bookButton}
                    />
                  )
                }
              />
            </div>
          </Card>
          {data ? (
            <RoutesPanel list={data} onOpen={openVisit} onAction={onAction} />
          ) : isPending ? (
            <CardSkeleton lines={6} />
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          {phlebotomists.length ? (
            <Field label={t('routeFor')} className="max-w-xs">
              <Select
                value={routeStaffId || undefined}
                onValueChange={(v) => url.set({ staff: v })}
                placeholder={tc('selectPlaceholder')}
                options={phlebotomists.map((p) => ({
                  value: p.id,
                  label:
                    p.id === actor?.id ? `${p.name} (${t('myRoute')})` : p.name,
                  description: t('load', { count: load.get(p.id) ?? 0 }),
                }))}
              />
            </Field>
          ) : null}
          {isPending ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <CardSkeleton lines={6} />
              <CardSkeleton lines={6} />
              <CardSkeleton lines={6} className="hidden 2xl:block" />
            </div>
          ) : isError || !data ? (
            <Card>
              <ErrorState onRetry={() => void refetch()} />
            </Card>
          ) : !routeStaff ? (
            <Card>
              <EmptyState
                icon={<RouteIcon />}
                tone="rose"
                title={t('noPhlebotomists')}
              />
            </Card>
          ) : (
            <RouteBoard
              visits={routeVisits}
              name={routeStaff.name}
              onOpen={openVisit}
              onAction={onAction}
            />
          )}
        </div>
      )}

      <VisitDrawer
        visitId={visitId ?? ''}
        visit={data?.rows.find((r) => r.id === visitId)}
        isLoading={isPending}
        isError={isError}
        onRetry={() => void refetch()}
        onClose={closeVisit}
        onAction={onAction}
      />
      <VisitDialogs
        target={target}
        onClose={() => setTarget(null)}
        phlebotomists={phlebotomists}
        load={load}
      />
      <BookVisitDialog
        open={booking}
        onOpenChange={setBooking}
        defaultDay={day}
        onBooked={onBooked}
      />
    </>
  )
}
