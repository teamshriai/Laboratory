import {
  BellRingIcon,
  CirclePlayIcon,
  ListOrderedIcon,
  XIcon,
} from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useDeferredValue, useState } from 'react'
import {
  CONTAINERS,
  DEPARTMENTS,
  ENCOUNTER_TYPES,
  PRIORITIES,
  type ContainerId,
  type DepartmentId,
  type EncounterType,
  type Priority,
} from '@/domain/types'
import { useUrlFilters } from '@/hooks/use-search-param'
import { ExportButton } from '@/components/lab/export-button'
import { FilterBar } from '@/components/lab/filter-bar'
import { RecordLink } from '@/components/lab/record-link'
import { Field } from '@/components/ui/field'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { DEPARTMENT_TONES } from '@/lib/icon-tones'
import { DEPARTMENT_ICONS } from '@/app/layout/nav-config'
import { usePreferences } from '@/app/preferences/context'
import {
  labApi,
  WORK_BUCKETS,
  type DatePreset,
  type WorkBucket,
  type WorkQueueRow,
} from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useWorkQueueList } from '@/services/queries'
import { PatientCell } from '@/components/lab/patient'
import { ContainerChip } from '@/components/lab/sample'
import { PriorityMark, SampleStatusBadge } from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { TestChips } from '@/components/lab/test-chips'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { IconGlyph } from '@/components/ui/icon-tile'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { AssignMenu, QueueActions } from './queue-actions'
import { useOpenSample } from './use-open-sample'

const DATES = ['all', 'today', 'yesterday', '7d'] as const

export function Component() {
  const t = useT('workQueue')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const openSample = useOpenSample()
  const { department: working } = usePreferences()
  const filters = useUrlFilters(
    {
      bucket: 'all',
      department: working ?? 'all',
      priority: 'all',
      assignee: 'all',
      date: 'all',
      container: 'all',
      doctor: 'all',
      encounter: 'all',
      ward: 'all',
      tat: 'all',
    },
    {
      bucket: WORK_BUCKETS,
      department: ['all', ...DEPARTMENTS],
      priority: ['all', ...PRIORITIES],
      date: DATES,
      container: ['all', ...CONTAINERS],
      encounter: ['all', ...ENCOUNTER_TYPES],
      tat: ['all', 'on-track', 'at-risk', 'overdue'],
    },
  )
  const v = filters.values
  const bucket = v.bucket as WorkBucket
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const MORE = [
    'assignee',
    'date',
    'container',
    'doctor',
    'encounter',
    'ward',
    'tat',
  ] as const

  const { data, isPending, isError, refetch, dataUpdatedAt } = useWorkQueueList(
    {
      bucket,
      q,
      ...(v.department !== 'all'
        ? { department: v.department as DepartmentId }
        : {}),
      ...(v.priority !== 'all' ? { priority: v.priority as Priority } : {}),
      ...(v.assignee !== 'all' ? { assignee: v.assignee } : {}),
      ...(v.container !== 'all'
        ? { container: v.container as ContainerId }
        : {}),
      ...(v.doctor !== 'all' ? { doctorId: v.doctor } : {}),
      ...(v.encounter !== 'all'
        ? { encounter: v.encounter as EncounterType }
        : {}),
      ...(v.ward !== 'all' ? { ward: v.ward } : {}),
      ...(v.tat !== 'all'
        ? { tat: v.tat as 'on-track' | 'at-risk' | 'overdue' }
        : {}),
      date: v.date as DatePreset,
    },
  )
  const startMany = useLabMutation(
    (ids: string[]) => labApi.samples.startMany(ids),
    {
      success: (n) => t('startedToast', { count: n }),
      onSuccess: () => setSelected(new Set()),
    },
  )

  const rows = data?.rows
  const picked = rows?.filter((r) => selected.has(r.id)) ?? []
  const startable = picked.filter((r) => r.status === 'received')
  const dateText = (at?: number) =>
    at === undefined ? (
      <span className="text-fg-subtle">-</span>
    ) : (
      <span className="whitespace-nowrap tabular-nums">
        {now - at > 20 * 3_600_000 ? `${f.dateShort(at)}, ` : ''}
        {f.time(at)}
      </span>
    )

  const columns: Column<WorkQueueRow>[] = [
    {
      id: 'sample',
      header: t('colSample'),
      sortValue: (r) => ({ stat: 0, urgent: 1, routine: 2 })[r.priority],
      cell: (r) => (
        <div className="grid gap-1">
          <PriorityMark priority={r.priority} />
          {r.accessionNo ? (
            <RecordLink
              kind="specimen"
              id={r.id}
              className="text-meta font-semibold whitespace-nowrap text-fg"
            >
              {r.accessionNo}
            </RecordLink>
          ) : (
            <span className="text-meta text-fg-subtle">
              {t('notCollected')}
            </span>
          )}
          <ContainerChip
            container={r.container}
            className="text-xs text-fg-muted"
          />
        </div>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      sortValue: (r) => r.patient.name,
      cell: (r) => (
        <PatientCell
          patient={r.patient}
          size="sm"
          showLocal={false}
          avatar={false}
        />
      ),
    },
    {
      id: 'tests',
      header: t('colTests'),
      sortValue: (r) => r.department,
      cell: (r) => (
        <div className="grid justify-items-start gap-1">
          <TestChips tests={r.tests} max={3} />
          <span className="inline-flex items-center gap-1.5 text-2xs text-fg-muted">
            <IconGlyph
              icon={DEPARTMENT_ICONS[r.department]}
              tone={DEPARTMENT_TONES[r.department]}
              size={14}
            />
            {e('department', r.department)}
            {r.status === 'processing' && r.testCount > 0 ? (
              <span className="text-fg-subtle tabular-nums">
                ·{' '}
                {r.allEntered
                  ? t('validatedProgress', {
                      validated: r.validatedCount,
                      total: r.testCount,
                    })
                  : t('progress', {
                      entered: r.enteredCount,
                      total: r.testCount,
                    })}
              </span>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      id: 'collected',
      header: t('colTimes'),
      className: 'max-[1439px]:hidden',
      headerClassName: 'max-[1439px]:hidden',
      sortValue: (r) => r.collectedAt ?? 0,
      cell: (r) => (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
          <dt className="text-fg-subtle">{t('abbrCollected')}</dt>
          <dd className="text-fg">{dateText(r.collectedAt)}</dd>
          <dt className="text-fg-subtle">{t('abbrReceived')}</dt>
          <dd className="text-fg">{dateText(r.receivedAt)}</dd>
        </dl>
      ),
    },
    {
      id: 'status',
      header: t('colStatusTat'),
      sortValue: (r) => r.tat?.ratio ?? -1,
      cell: (r) => (
        <div className="grid justify-items-start gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <SampleStatusBadge status={r.status} size="sm" />
            {r.openCriticals ? (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold text-danger-text">
                <BellRingIcon
                  strokeWidth={2.2}
                  className="size-3"
                  aria-hidden
                />
                <span aria-hidden>{r.openCriticals}</span>
                <span className="sr-only">
                  {t('criticalOpen', { count: r.openCriticals })}
                </span>
              </span>
            ) : null}
          </div>
          {r.tat && r.tat.state !== 'not-started' && r.tat.state !== 'met' ? (
            <TatIndicator tat={r.tat} compact />
          ) : null}
        </div>
      ),
    },
    {
      id: 'assigned',
      tabletHidden: true,
      header: t('colAssigned'),
      sortValue: (r) => r.assignedName ?? '~',
      cell: (r) =>
        data &&
        !['completed', 'rejected', 'pending_collection', 'collected'].includes(
          r.status,
        ) ? (
          <AssignMenu
            ids={[r.id]}
            current={
              r.assignedTo
                ? { id: r.assignedTo, name: r.assignedName ?? r.assignedTo }
                : undefined
            }
            technicians={data.technicians}
            department={r.department}
          />
        ) : (
          <span className="text-meta text-fg-muted">
            {r.assignedName ?? '-'}
          </span>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      cell: (r) => <QueueActions row={r} />,
    },
  ]

  const emptyBody =
    bucket === 'critical' || bucket === 'overdue' || bucket === 'rejected'
      ? t(`empty-${bucket}`)
      : t('emptyBody')
  const activeFilters = filters.activeCount() - (bucket === 'all' ? 0 : 1)

  // The "More filters" in use, each removable on its own.
  const chipValue: Record<(typeof MORE)[number], (x: string) => string> = {
    assignee: (x) =>
      x === 'unassigned'
        ? t('unassigned')
        : (data?.technicians.find((s) => s.id === x)?.name ?? x),
    date: (x) => e('datePreset', x as DatePreset),
    container: (x) => e('container', x as (typeof CONTAINERS)[number]),
    doctor: (x) => data?.doctors.find((d) => d.id === x)?.name ?? x,
    encounter: (x) => e('encounter', x as (typeof ENCOUNTER_TYPES)[number]),
    ward: (x) => x,
    tat: (x) =>
      x === 'on-track'
        ? t('tatOnTrack')
        : x === 'at-risk'
          ? t('tatAtRisk')
          : t('tatOverdue'),
  }
  const chipField: Record<(typeof MORE)[number], string> = {
    assignee: t('colAssigned'),
    date: t('filterCollected'),
    container: t('filterSampleType'),
    doctor: t('filterDoctor'),
    encounter: t('filterEncounter'),
    ward: t('filterWard'),
    tat: t('filterTat'),
  }
  const chips = MORE.filter((k) => v[k] !== 'all').map((k) => ({
    key: k,
    label: `${chipField[k]}: ${chipValue[k](v[k])}`,
    onRemove: () => filters.set({ [k]: 'all' }),
  }))

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          dataUpdatedAt ? (
            <span>{t('updated', { time: f.time(dataUpdatedAt) })}</span>
          ) : null
        }
        actions={
          <ExportButton
            filename={t('exportFile')}
            disabled={!data?.rows.length}
            rows={() => [
              [
                t('colSample'),
                t('colPatient'),
                tc('uhid'),
                t('colDepartment'),
                t('colTests'),
                t('colPriority'),
                tc('status'),
                tc('collectedAt'),
                tc('receivedAt'),
                tc('tat'),
                t('colAssigned'),
              ],
              ...(data?.rows ?? []).map((r) => [
                r.accessionNo,
                r.patient.name,
                r.patient.uhid,
                e('department', r.department),
                r.tests.map((x) => x.shortName).join('; '),
                e('priority', r.priority),
                e('sampleStatus', r.status),
                r.collectedAt ? f.dateTime(r.collectedAt) : '',
                r.receivedAt ? f.dateTime(r.receivedAt) : '',
                r.tat ? e('tatState', r.tat.state) : '',
                r.assignedName ?? '',
              ]),
            ]}
          />
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-2">
          <FilterTabs
            value={bucket}
            onValueChange={(next) => {
              filters.set({ bucket: next })
              setSelected(new Set())
            }}
            aria-label={t('title')}
            className="md:flex-wrap md:overflow-visible"
            items={WORK_BUCKETS.map((b) => ({
              value: b,
              label: b === 'all' ? t('bucketAll') : t(`bucket-${b}`),
              count: data?.counts[b] ?? 0,
              ...(b === 'critical' && (data?.counts.critical ?? 0) > 0
                ? { tone: 'danger' as const }
                : {}),
            }))}
          />
        </div>
        <FilterBar
          chips={chips}
          canClear={activeFilters > 0 || query !== ''}
          onClear={() => {
            setQuery('')
            filters.clear(['department', 'priority', ...MORE])
          }}
          moreCount={filters.activeCount([...MORE])}
          more={
            <>
              <Field label={t('colAssigned')}>
                <Select
                  value={v.assignee}
                  onValueChange={(x) => filters.set({ assignee: x })}
                  options={[
                    { value: 'all', label: t('anyone') },
                    { value: 'unassigned', label: t('unassigned') },
                    ...(data?.technicians ?? []).map((s) => ({
                      value: s.id,
                      label: s.name,
                    })),
                  ]}
                />
              </Field>
              <Field label={t('filterCollected')}>
                <Select
                  value={v.date}
                  onValueChange={(x) => filters.set({ date: x })}
                  options={DATES.map((d) => ({
                    value: d,
                    label: d === 'all' ? t('anyDate') : e('datePreset', d),
                  }))}
                />
              </Field>
              <Field label={t('filterSampleType')}>
                <Select
                  value={v.container}
                  onValueChange={(x) => filters.set({ container: x })}
                  options={[
                    { value: 'all', label: t('anySampleType') },
                    ...CONTAINERS.map((c) => ({
                      value: c,
                      label: e('container', c),
                    })),
                  ]}
                />
              </Field>
              <Field label={t('filterDoctor')}>
                <Select
                  value={v.doctor}
                  onValueChange={(x) => filters.set({ doctor: x })}
                  options={[
                    { value: 'all', label: t('anyDoctor') },
                    ...(data?.doctors ?? []).map((d) => ({
                      value: d.id,
                      label: d.name,
                    })),
                  ]}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('filterEncounter')}>
                  <Select
                    value={v.encounter}
                    onValueChange={(x) => filters.set({ encounter: x })}
                    options={[
                      { value: 'all', label: t('anyEncounter') },
                      ...ENCOUNTER_TYPES.map((x) => ({
                        value: x,
                        label: e('encounter', x),
                      })),
                    ]}
                  />
                </Field>
                <Field label={t('filterWard')}>
                  <Select
                    value={v.ward}
                    onValueChange={(x) => filters.set({ ward: x })}
                    options={[
                      { value: 'all', label: t('anyWard') },
                      ...(data?.wards ?? []).map((w) => ({
                        value: w,
                        label: w,
                      })),
                    ]}
                  />
                </Field>
              </div>
              <Field label={t('filterTat')}>
                <Select
                  value={v.tat}
                  onValueChange={(x) => filters.set({ tat: x })}
                  options={[
                    { value: 'all', label: t('anyTat') },
                    { value: 'on-track', label: t('tatOnTrack') },
                    { value: 'at-risk', label: t('tatAtRisk') },
                    { value: 'overdue', label: t('tatOverdue') },
                  ]}
                />
              </Field>
            </>
          }
        >
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('search')}
            aria-label={tc('search')}
            className="w-full sm:max-w-sm"
          />
          <Select
            size="sm"
            className="w-full sm:w-44"
            aria-label={t('colDepartment')}
            value={v.department}
            onValueChange={(x) => filters.set({ department: x })}
            options={[
              { value: 'all', label: t('allDepartments') },
              ...DEPARTMENTS.map((d) => ({
                value: d,
                label: e('department', d),
              })),
            ]}
          />
          <Select
            size="sm"
            className="w-full sm:w-36"
            aria-label={t('colPriority')}
            value={v.priority}
            onValueChange={(x) => filters.set({ priority: x })}
            options={[
              { value: 'all', label: t('allPriorities') },
              ...PRIORITIES.map((p) => ({ value: p, label: e('priority', p) })),
            ]}
          />
        </FilterBar>

        {picked.length ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-accent-soft/40 px-4 py-2">
            <span className="text-meta font-medium text-fg">
              {t('selected', { count: picked.length })}
            </span>
            {data ? (
              <AssignMenu
                ids={picked.map((r) => r.id)}
                technicians={data.technicians}
                trigger="button"
              />
            ) : null}
            {startable.length ? (
              <Button
                size="sm"
                variant="secondary"
                loading={startMany.isPending}
                onClick={() => startMany.mutate(startable.map((r) => r.id))}
              >
                <CirclePlayIcon />
                {t('bulkStart')} ({startable.length})
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => setSelected(new Set())}
            >
              <XIcon />
              {t('clearSelection')}
            </Button>
          </div>
        ) : null}

        <DataTable
          caption={t('title')}
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          rowLabel={(r) => r.accessionNo ?? r.patient.name}
          onRowClick={(r) => openSample(r.id)}
          isLoading={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          minWidth={940}
          mobile={{
            primary: 'sample',
            fields: ['patient', 'status'],
            actions: 'actions',
          }}
          pageSize={25}
          selection={{
            selected,
            onChange: setSelected,
            isSelectable: (r) =>
              !['completed', 'rejected', 'discarded'].includes(r.status),
          }}
          rowClassName={(r) =>
            cn(
              r.openCriticals > 0 && 'row-alert',
              r.priority === 'stat' && 'shadow-[inset_3px_0_0_var(--danger)]',
            )
          }
          empty={
            <EmptyState
              icon={<ListOrderedIcon />}
              tone="indigo"
              title={t('emptyTitle')}
              description={emptyBody}
            />
          }
        />
      </Card>
    </>
  )
}
