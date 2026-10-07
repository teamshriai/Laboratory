import {
  CalendarClockIcon,
  RefreshCwIcon,
  ClipboardListIcon,
  EllipsisIcon,
  DropletIcon,
  EyeIcon,
  PackageIcon,
  PrinterIcon,
  SyringeIcon,
  TruckIcon,
  CircleXIcon,
} from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { PRIORITIES, type Priority } from '@/domain/types'
import { usePreferences } from '@/app/preferences/context'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam, useSearchParam } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type SampleRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useCollectionQueue } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { FilterBar } from '@/components/lab/filter-bar'
import { RecordLink } from '@/components/lab/record-link'
import { LabelPrintDialog } from '@/components/lab/labels'
import { PatientCell } from '@/components/lab/patient'
import { RejectSampleDialog } from '@/components/lab/reject-sample-dialog'
import { ContainerChip } from '@/components/lab/sample'
import { PriorityMark } from '@/components/lab/status'
import { Waiting } from '@/components/lab/tat'
import { TestChips } from '@/components/lab/test-chips'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { CollectDrawer } from './collect-drawer'

type Tab = 'pending' | 'collected'
const TABS: readonly Tab[] = ['pending', 'collected']
const PRIORITY_FILTERS: readonly (Priority | 'all')[] = ['all', ...PRIORITIES]

export function Component() {
  const t = useT('collection')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const { department } = usePreferences()
  // Tab and filters live in the URL so a view can be linked and reloaded.
  const [tab, setTab] = useSearchParam<Tab>('tab', 'pending', TABS)
  const [priority, setPriority] = useSearchParam<Priority | 'all'>(
    'priority',
    'all',
    PRIORITY_FILTERS,
  )
  const [query, setQuery] = useSearchParam<string>('q', '')
  const q = useDeferredValue(query)
  const { data, isPending, isError, refetch } = useCollectionQueue({
    q,
    ...(department ? { department } : {}),
    ...(priority !== 'all' ? { priority } : {}),
  })
  const [labelFor, setLabelFor] = useState<SampleRow | null>(null)
  const [rejecting, setRejecting] = useState<SampleRow | null>(null)
  const [collectId, openCollect, closeCollect] = useOverlayParam('collect')
  const [, openOrder] = useOverlayParam('order')
  const [, openSample] = useOverlayParam('sample')

  const receive = useLabMutation((ref: string) => labApi.samples.receive(ref), {
    success: (r) => t('received', { accession: r.accessionNo ?? '' }),
  })

  // A deferred collection (post-prandial, timed) is not due yet: it sinks
  // below the tubes to draw now, soonest first.
  const notDue = (r: SampleRow) =>
    r.scheduledFor !== undefined && r.scheduledFor > now
  const pending = data?.pending.toSorted((a, b) => {
    const da = notDue(a)
    const db = notDue(b)
    if (da && db) return (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0)
    return Number(da) - Number(db)
  })
  const collected = data?.collected
  const due = pending?.filter((s) => !notDue(s)) ?? []
  const scheduled = (pending?.length ?? 0) - due.length
  const stat = due.filter((s) => s.priority === 'stat').length
  const longest = due.length
    ? Math.max(...due.map((s) => now - s.createdAt))
    : 0
  const dueTime = (at: number) =>
    at - now > 12 * 3_600_000 ? f.dateTime(at) : f.time(at)
  const recollections = pending?.filter((s) => s.isRecollection).length ?? 0

  const pendingColumns: Column<SampleRow>[] = [
    {
      id: 'patient',
      header: t('colPatient'),
      sortValue: (r) => r.patient.name,
      cell: (r) => (
        <div className="grid gap-1">
          <PatientCell patient={r.patient} showLocal={false} />
          <span className="pl-12 text-xs text-fg-muted">
            {e('encounter', r.encounter)}
            {r.ward
              ? ` · ${r.bed ? tc('wardBed', { ward: r.ward, bed: r.bed }) : r.ward}`
              : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'order',
      tabletHidden: true,
      header: t('colOrder'),
      cell: (r) => (
        <div>
          <RecordLink
            kind="order"
            id={r.orderId}
            className="text-meta font-medium whitespace-nowrap text-fg"
          >
            {r.orderNo}
          </RecordLink>
          <p className="max-w-40 truncate text-xs text-fg-muted">
            {r.doctorName}
          </p>
        </div>
      ),
    },
    {
      id: 'tests',
      header: t('colTests'),
      cell: (r) => (
        <div className="grid max-w-56 justify-items-start gap-1">
          <TestChips tests={r.tests} max={2} />
          {r.isRecollection ? (
            <Badge tone="warning" size="sm">
              <RefreshCwIcon />
              {t('recollection')}
            </Badge>
          ) : null}
          {r.recollectionOf ? (
            <span className="text-xs text-fg-muted">
              {t('recollectionOf', { accession: r.recollectionOf })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'specimen',
      header: t('colSpecimen'),
      cell: (r) => (
        <div className="grid gap-1">
          <ContainerChip container={r.container} />
          <span className="flex items-center gap-2 text-xs whitespace-nowrap text-fg-muted">
            {e('specimen', r.specimen)}
            {r.fasting ? (
              <span className="inline-flex items-center gap-0.5 text-warning-text">
                <DropletIcon className="size-3" />
                {t('fasting')}
              </span>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      id: 'priority',
      header: t('colPriority'),
      sortValue: (r) => PRIORITIES.indexOf(r.priority) * -1,
      cell: (r) => <PriorityMark priority={r.priority} />,
    },
    {
      id: 'waiting',
      header: t('colWaiting'),
      sortValue: (r) => r.createdAt,
      cell: (r) =>
        notDue(r) && r.scheduledFor !== undefined ? (
          <div className="grid max-w-48 justify-items-start gap-1">
            <Badge tone="info" size="sm" title={r.scheduleReason}>
              <CalendarClockIcon aria-hidden />
              <span className="sr-only">{t('notYetDue')}: </span>
              {t('dueAt', { time: dueTime(r.scheduledFor) })}
            </Badge>
            {r.scheduleReason ? (
              <p
                className="max-w-full truncate text-xs text-fg-muted"
                title={r.scheduleReason}
              >
                {r.scheduleReason}
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <Waiting
              since={r.createdAt}
              warnAfterMin={r.priority === 'stat' ? 5 : 30}
              dangerAfterMin={r.priority === 'stat' ? 10 : 60}
            />
            <p className="mt-0.5 text-xs text-fg-subtle">
              {f.time(r.orderedAt ?? r.createdAt)}
            </p>
          </div>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      align: 'right',
      cell: (r) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(ev) => ev.stopPropagation()}
        >
          <Button size="xs" variant="primary" onClick={() => openCollect(r.id)}>
            <SyringeIcon />
            {t('collectShort')}
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={tc('moreActions')}
              >
                <EllipsisIcon strokeWidth={2.5} />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<PrinterIcon />} onSelect={() => setLabelFor(r)}>
                {t('printLabel')}
              </MenuItem>
              <MenuItem
                icon={<ClipboardListIcon />}
                onSelect={() => openOrder(r.orderId)}
              >
                {t('viewOrder')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<CircleXIcon />}
                danger
                onSelect={() => setRejecting(r)}
              >
                {t('unableToCollect')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      ),
    },
  ]

  const collectedColumns: Column<SampleRow>[] = [
    {
      id: 'sample',
      header: t('colSample'),
      sortValue: (r) => r.accessionNo ?? '',
      cell: (r) => (
        <div className="grid justify-items-start gap-1">
          <RecordLink
            kind="specimen"
            id={r.id}
            className="text-meta font-semibold whitespace-nowrap text-fg"
          >
            {r.accessionNo}
          </RecordLink>
          <ContainerChip container={r.container} className="text-xs" />
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
      id: 'tests',
      header: t('colTests'),
      cell: (r) => <TestChips tests={r.tests} max={3} />,
    },
    {
      id: 'department',
      header: tc('department'),
      cell: (r) => (
        <span className="text-meta text-fg">
          {e('department', r.department)}
        </span>
      ),
    },
    {
      id: 'priority',
      header: t('colPriority'),
      cell: (r) => <PriorityMark priority={r.priority} />,
    },
    {
      id: 'collected',
      header: t('colCollected'),
      sortValue: (r) => r.collectedAt ?? 0,
      cell: (r) => (
        <div className="text-meta">
          <p className="text-fg">
            {r.collectedAt ? f.time(r.collectedAt) : ''}
          </p>
          <p className="text-xs text-fg-muted">{r.collectedBy}</p>
        </div>
      ),
    },
    {
      id: 'transit',
      header: t('colInTransit'),
      cell: (r) =>
        r.collectedAt ? (
          <Waiting
            since={r.collectedAt}
            warnAfterMin={30}
            dangerAfterMin={60}
          />
        ) : null,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      align: 'right',
      cell: (r) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(ev) => ev.stopPropagation()}
        >
          <GuardedButton
            permission="specimen.receive"
            size="xs"
            onClick={() => receive.mutate(r.id)}
            loading={receive.isPending && receive.variables === r.id}
          >
            <PackageIcon />
            {t('receive')}
          </GuardedButton>
          <Menu>
            <MenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={tc('moreActions')}
              >
                <EllipsisIcon strokeWidth={2.5} />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<PrinterIcon />} onSelect={() => setLabelFor(r)}>
                {t('printLabel')}
              </MenuItem>
              <MenuItem icon={<EyeIcon />} onSelect={() => openSample(r.id)}>
                {tc('viewSample')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<CircleXIcon />}
                danger
                onSelect={() => setRejecting(r)}
              >
                {t('reject')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          data ? (
            <>
              {stat ? (
                <span className="font-medium text-danger-text">
                  {t('kpiStat')}: {stat}
                </span>
              ) : null}
              {scheduled ? (
                <span>
                  {t('kpiScheduled')}: {scheduled}
                </span>
              ) : null}
              {recollections ? (
                <span>
                  {t('kpiRecollect')}: {recollections}
                </span>
              ) : null}
              <span>
                {t('kpiLongest')}: {longest ? f.duration(longest) : '-'}
              </span>
            </>
          ) : null
        }
      />
      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-1">
          <FilterTabs
            value={tab}
            onValueChange={setTab}
            items={[
              {
                value: 'pending',
                label: t('tabPending'),
                count: pending?.length,
              },
              {
                value: 'collected',
                label: t('tabCollected'),
                count: collected?.length,
              },
            ]}
          />
        </div>
        <FilterBar>
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('searchPlaceholder')}
            aria-label={tc('search')}
            className="w-full sm:w-80"
          />
          <Select
            size="sm"
            aria-label={t('colPriority')}
            value={priority}
            onValueChange={setPriority}
            className="w-36"
            options={[
              { value: 'all' as const, label: tc('all') },
              ...PRIORITIES.map((p) => ({ value: p, label: e('priority', p) })),
            ]}
          />
        </FilterBar>
        <div className="border-t border-line">
          {tab === 'pending' ? (
            <DataTable
              caption={t('tabPending')}
              columns={pendingColumns}
              rows={pending}
              getRowId={(r) => r.id}
              rowLabel={(r) => r.patient.name}
              onRowClick={(r) => openCollect(r.id)}
              activeRowId={collectId}
              isLoading={isPending}
              isError={isError}
              onRetry={() => void refetch()}
              minWidth={980}
              empty={
                <EmptyState
                  icon={<SyringeIcon />}
                  title={t('emptyPendingTitle')}
                  description={t('emptyPendingBody')}
                />
              }
            />
          ) : (
            <DataTable
              caption={t('tabCollected')}
              columns={collectedColumns}
              rows={collected}
              getRowId={(r) => r.id}
              isLoading={isPending}
              isError={isError}
              onRetry={() => void refetch()}
              minWidth={1000}
              empty={
                <EmptyState
                  icon={<TruckIcon />}
                  title={t('emptyCollectedTitle')}
                  description={t('emptyCollectedBody')}
                />
              }
            />
          )}
        </div>
      </Card>

      {collectId ? (
        <CollectDrawer sampleId={collectId} onClose={closeCollect} />
      ) : null}
      {labelFor ? (
        <LabelPrintDialog
          open
          onOpenChange={(o) => !o && setLabelFor(null)}
          samples={[labelFor]}
        />
      ) : null}
      <RejectSampleDialog
        sample={rejecting}
        open={rejecting !== null}
        onOpenChange={(o) => !o && setRejecting(null)}
      />
    </>
  )
}
