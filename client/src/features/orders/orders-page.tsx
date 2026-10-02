import {
  RefreshCwIcon,
  BellRingIcon,
  ClipboardListIcon,
  FunnelIcon,
  PlusIcon,
} from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  DEPARTMENTS,
  ENCOUNTER_TYPES,
  ORDER_STATUSES,
  PRIORITIES,
  type DepartmentId,
  type EncounterType,
  type OrderStatus,
  type Priority,
} from '@/domain/types'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { useNow } from '@/hooks/use-now'
import type { DatePreset, OrderRow } from '@/services/lab-api'
import { useOrderableTests, useOrders, useReference } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { ExportButton } from '@/components/lab/export-button'
import { FilterBar } from '@/components/lab/filter-bar'
import { PatientCell } from '@/components/lab/patient'
import { OrderStatusBadge, PriorityMark } from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { TestChips } from '@/components/lab/test-chips'
import { Button, buttonVariants } from '@/components/ui/button'
import { Count } from '@/components/ui/badge'
import { Field } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { Card } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'

interface Filters {
  status: OrderStatus | 'all'
  date: DatePreset
  department: DepartmentId | 'all'
  priority: Priority | 'all'
  encounter: EncounterType | 'all'
  doctorId: string
  testId: string
}

const DATES = ['today', 'yesterday', '7d', '30d', 'all'] as const

const DEFAULTS: Filters = {
  status: 'all',
  date: 'today',
  department: 'all',
  priority: 'all',
  encounter: 'all',
  doctorId: '',
  testId: '',
}

export function Component() {
  const t = useT('orders')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // Filters live in the URL (linkable, survive reloads); unknown values in a
  // hand-edited link fall back to the defaults.
  const url = useUrlFilters(
    { ...DEFAULTS, q: '' },
    {
      status: ['all', ...ORDER_STATUSES],
      date: DATES,
      department: ['all', ...DEPARTMENTS],
      priority: ['all', ...PRIORITIES],
      encounter: ['all', ...ENCOUNTER_TYPES],
    },
  )
  const filters = url.values as Filters & { q: string }
  const setFilters = (next: Filters) => url.set(next)
  const query = filters.q
  const setQuery = (q: string) => url.set({ q })
  const q = useDeferredValue(query)
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    url.set({ [key]: value })

  const { data, isPending, isError, refetch } = useOrders({
    status: filters.status,
    date: filters.date,
    q,
    ...(filters.department !== 'all' ? { department: filters.department } : {}),
    ...(filters.priority !== 'all' ? { priority: filters.priority } : {}),
    ...(filters.encounter !== 'all' ? { encounter: filters.encounter } : {}),
    ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
    ...(filters.testId ? { testId: filters.testId } : {}),
  })
  const { data: reference } = useReference()
  const { data: tests } = useOrderableTests()
  const activeOrder = params.get('order')

  const openOrder = (row: OrderRow) => {
    if (row.status === 'draft') {
      void navigate(`/orders/new?draft=${row.id}`)
      return
    }
    const next = new URLSearchParams(params)
    next.set('order', row.id)
    setParams(next)
  }

  const columns = useMemo<Column<OrderRow>[]>(
    () => [
      {
        id: 'order',
        header: t('colOrder'),
        sortValue: (r) => r.orderedAt ?? r.createdAt,
        cell: (r) => (
          <div className="min-w-0">
            <p className="font-mono text-meta font-semibold whitespace-nowrap text-fg">
              {r.orderNo ?? t('draftBadge')}
            </p>
            <p
              className="text-xs whitespace-nowrap text-fg-muted"
              title={f.relative(r.orderedAt ?? r.createdAt, now)}
            >
              {filters.date === 'today'
                ? f.time(r.orderedAt ?? r.createdAt)
                : f.dateTime(r.orderedAt ?? r.createdAt)}
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
        id: 'tests',
        header: t('colTests'),
        cell: (r) => (
          <div className="grid max-w-52 gap-1">
            <TestChips tests={r.tests} max={2} />
            <span className="truncate text-xs text-fg-subtle">
              {r.departments.map((d) => e('department', d)).join(', ')}
            </span>
          </div>
        ),
      },
      {
        id: 'doctor',
        tabletHidden: true,
        header: t('colDoctor'),
        sortValue: (r) => r.doctor.name,
        cell: (r) => (
          <div className="max-w-44 min-w-0">
            <p className="truncate text-meta font-medium text-fg">
              {r.doctor.name}
            </p>
            <p className="truncate text-xs text-fg-muted">
              {e('encounter', r.encounter)}
              {r.ward
                ? ` · ${r.ward}${r.bed ? ` / ${r.bed}` : ''}`
                : ` · ${e('clinicalDepartment', r.clinicalDepartment)}`}
            </p>
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
        id: 'status',
        header: t('colStatus'),
        sortValue: (r) => ORDER_STATUSES.indexOf(r.status),
        cell: (r) => (
          <div className="flex flex-col items-start gap-1">
            <OrderStatusBadge status={r.status} size="sm" />
            {r.progress.total &&
            r.status !== 'completed' &&
            r.status !== 'cancelled' ? (
              <span className="text-xs text-fg-muted tabular-nums">
                {t('progressValidated', {
                  done: r.progress.validated,
                  total: r.progress.total,
                })}
              </span>
            ) : null}
            {r.hasRecollection ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-text">
                <RefreshCwIcon className="size-3" aria-hidden />
                {t('recollection')}
              </span>
            ) : null}
            {r.openCriticals > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger-text">
                <BellRingIcon
                  strokeWidth={2.2}
                  className="size-3"
                  aria-hidden
                />
                {t('critical', { count: r.openCriticals })}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'tat',
        header: t('colTat'),
        sortValue: (r) => r.tat?.ratio ?? -1,
        cell: (r) => <TatIndicator tat={r.tat} />,
      },
    ],
    [t, e, f, now, filters.date],
  )

  const counts = data?.counts
  const tabs = [
    { value: 'all' as const, label: t('tabAll'), count: counts?.all },
    ...(
      [
        'new',
        'collected',
        'processing',
        'pending-result',
        'awaiting-validation',
        'completed',
        'cancelled',
      ] as const
    ).map((s) => ({
      value: s,
      label: e('orderStatus', s),
      count: counts?.[s],
    })),
    { value: 'draft' as const, label: t('tabDrafts'), count: counts?.draft },
  ]
  const moreCount = [
    filters.encounter !== 'all',
    Boolean(filters.doctorId),
    Boolean(filters.testId),
  ].filter(Boolean).length
  const dirty =
    url.activeCount([
      'date',
      'department',
      'priority',
      'encounter',
      'doctorId',
      'testId',
      'q',
    ]) > 0

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <>
            <ExportButton
              filename={t('exportFile')}
              disabled={!data?.rows.length}
              rows={() => [
                [
                  t('colOrder'),
                  tc('orderedAt'),
                  t('colPatient'),
                  tc('uhid'),
                  t('colDoctor'),
                  t('colPriority'),
                  t('colStatus'),
                  t('colTests'),
                ],
                ...(data?.rows ?? []).map((r) => [
                  r.orderNo,
                  r.orderedAt ? f.dateTime(r.orderedAt) : '',
                  r.patient.name,
                  r.patient.uhid,
                  r.doctor.name,
                  e('priority', r.priority),
                  e('orderStatus', r.status),
                  r.tests.map((x) => x.shortName).join('; '),
                ]),
              ]}
            />
            <Link
              to="/orders/new"
              className={buttonVariants({ variant: 'primary' })}
            >
              <PlusIcon strokeWidth={2.5} />
              {t('newOrder')}
            </Link>
          </>
        }
      />
      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-1">
          <FilterTabs
            value={filters.status}
            onValueChange={(v) => set('status', v)}
            items={tabs}
            aria-label={t('colStatus')}
          />
        </div>
        <FilterBar
          canClear={dirty}
          onClear={() => {
            setFilters({ ...DEFAULTS, status: filters.status })
            setQuery('')
          }}
        >
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('searchPlaceholder')}
            aria-label={tc('search')}
            className="w-full sm:w-96"
          />
          <Select
            size="sm"
            aria-label={t('filterDate')}
            value={filters.date}
            onValueChange={(v) => set('date', v)}
            options={DATES.map((d) => ({
              value: d,
              label: e('datePreset', d),
            }))}
            className="w-36"
          />
          <Select
            size="sm"
            aria-label={t('filterDepartment')}
            value={filters.department}
            onValueChange={(v) => set('department', v)}
            options={[
              { value: 'all' as const, label: t('anyDepartment') },
              ...DEPARTMENTS.map((d) => ({
                value: d,
                label: e('department', d),
              })),
            ]}
            className="w-44"
          />
          <Select
            size="sm"
            aria-label={t('filterPriority')}
            value={filters.priority}
            onValueChange={(v) => set('priority', v)}
            options={[
              { value: 'all' as const, label: t('anyPriority') },
              ...PRIORITIES.map((p) => ({ value: p, label: e('priority', p) })),
            ]}
            className="w-36"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={moreCount ? 'soft' : 'secondary'}>
                <FunnelIcon />
                {t('moreFilters')}
                {moreCount ? <Count value={moreCount} tone="accent" /> : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="grid w-80 gap-3 p-4">
              <Field label={t('filterEncounter')}>
                <Select
                  value={filters.encounter}
                  onValueChange={(v) => set('encounter', v)}
                  options={[
                    { value: 'all' as const, label: t('anyEncounter') },
                    ...ENCOUNTER_TYPES.map((x) => ({
                      value: x,
                      label: e('encounter', x),
                    })),
                  ]}
                />
              </Field>
              <Field label={t('filterDoctor')}>
                <Combobox
                  value={filters.doctorId || undefined}
                  onValueChange={(v) =>
                    set('doctorId', v === filters.doctorId ? '' : v)
                  }
                  placeholder={t('anyDoctor')}
                  searchPlaceholder={t('searchDoctors')}
                  emptyText={t('noDoctors')}
                  options={(reference?.doctors ?? []).map((d) => ({
                    value: d.id,
                    label: d.name,
                    description: e('clinicalDepartment', d.department),
                  }))}
                />
              </Field>
              <Field label={t('filterTest')}>
                <Combobox
                  value={filters.testId || undefined}
                  onValueChange={(v) =>
                    set('testId', v === filters.testId ? '' : v)
                  }
                  placeholder={t('anyTest')}
                  searchPlaceholder={t('searchTests')}
                  emptyText={t('noTests')}
                  options={(tests ?? []).map((x) => ({
                    value: x.id,
                    label: x.shortName,
                    description: x.name,
                    keywords: [x.code, x.name],
                  }))}
                />
              </Field>
            </PopoverContent>
          </Popover>
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('title')}
            columns={columns}
            rows={data?.rows}
            getRowId={(r) => r.id}
            rowLabel={(r) => r.orderNo ?? r.patient.name}
            onRowClick={openOrder}
            activeRowId={activeOrder}
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            minWidth={1040}
            empty={
              <EmptyState
                icon={<ClipboardListIcon />}
                title={
                  filters.status === 'draft'
                    ? t('emptyDraftsTitle')
                    : t('emptyTitle')
                }
                description={
                  filters.status === 'draft'
                    ? t('emptyDraftsBody')
                    : t('emptyBody')
                }
                action={
                  dirty ? (
                    <button
                      type="button"
                      className={buttonVariants({ variant: 'secondary' })}
                      onClick={() => {
                        setFilters({ ...DEFAULTS, status: filters.status })
                        setQuery('')
                      }}
                    >
                      {tc('clearFilters')}
                    </button>
                  ) : (
                    <Link
                      to="/orders/new"
                      className={buttonVariants({ variant: 'primary' })}
                    >
                      <PlusIcon strokeWidth={2.5} />
                      {t('newOrder')}
                    </Link>
                  )
                }
              />
            }
          />
        </div>
      </Card>
    </>
  )
}
