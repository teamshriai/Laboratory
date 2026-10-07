import { useOverlayParam, useSearchParam } from '@/hooks/use-search-param'
import { LibraryIcon, InfoIcon, PlusIcon } from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useDeferredValue, useState } from 'react'
import {
  DEPARTMENTS,
  SPECIMENS,
  type DepartmentId,
  type SpecimenId,
} from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { DEPARTMENT_TONES } from '@/lib/icon-tones'
import { DEPARTMENT_ICONS } from '@/app/layout/nav-config'
import type { CatalogTest } from '@/services/lab-api'
import { useCatalog } from '@/services/queries'
import { ContainerChip } from '@/components/lab/sample'
import { Badge } from '@/components/ui/badge'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { IconGlyph } from '@/components/ui/icon-tile'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { TestDrawer } from './test-drawer'
import { TestFormDialog } from './test-form-dialog'

type Status = 'all' | 'active' | 'inactive'

const DEPARTMENT_FILTER = ['all', ...DEPARTMENTS] as const

export function Component() {
  const t = useT('catalog')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const [status, setStatus] = useState<Status>('active')
  const [department, setDepartment] = useSearchParam<DepartmentId | 'all'>(
    'department',
    'all',
    DEPARTMENT_FILTER,
  )
  const [specimen, setSpecimen] = useState<SpecimenId | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const all = useCatalog({ status: 'all' })
  const { data, isPending, isError, refetch } = useCatalog({
    q,
    status,
    ...(department !== 'all' ? { department } : {}),
    ...(specimen !== 'all' ? { specimen } : {}),
  })
  const [openId, setOpen, closeOpen] = useOverlayParam('test')

  const tests = all.data ?? []
  const columns: Column<CatalogTest>[] = [
    {
      id: 'name',
      header: t('colTest'),
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-meta font-medium text-fg">{r.name}</p>
          <p className="text-xs text-fg-muted">
            <span className="font-mono">{r.code}</span> · {r.shortName}
            {r.category ? ` · ${r.category}` : ''}
          </p>
        </div>
      ),
    },
    {
      id: 'department',
      header: t('colDepartment'),
      sortValue: (r) => r.department,
      cell: (r) => (
        <span className="inline-flex items-center gap-2 text-meta whitespace-nowrap text-fg">
          <IconGlyph
            icon={DEPARTMENT_ICONS[r.department]}
            tone={DEPARTMENT_TONES[r.department]}
            size={17}
          />
          {e('department', r.department)}
        </span>
      ),
    },
    {
      id: 'specimen',
      header: t('colSpecimen'),
      cell: (r) => (
        <div className="grid gap-0.5">
          <span className="text-meta whitespace-nowrap text-fg">
            {e('specimen', r.specimen)}
          </span>
          <ContainerChip
            container={r.container}
            className="text-xs text-fg-muted"
          />
        </div>
      ),
    },
    {
      id: 'method',
      tabletHidden: true,
      header: t('colMethod'),
      cell: (r) => (
        <span className="line-clamp-2 max-w-48 text-meta text-fg-muted">
          {r.method ?? '-'}
        </span>
      ),
    },
    {
      id: 'tat',
      header: t('colTat'),
      sortValue: (r) => r.tatHours,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {f.hours(r.tatHours)}
          <span className="block text-2xs text-fg-subtle">
            {t('statTat', { value: f.hours(r.statTatHours) })}
          </span>
        </span>
      ),
    },
    {
      id: 'price',
      header: t('colPrice'),
      align: 'right',
      sortValue: (r) => r.price,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap tabular-nums">
          <span className="font-semibold text-fg">{f.currency(r.price)}</span>
          {r.priceInsurance ? (
            <span className="block text-2xs text-fg-subtle">
              {f.currency(r.priceInsurance)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'orders',
      header: t('colOrders'),
      align: 'right',
      sortValue: (r) => r.ordersLast30Days,
      cell: (r) => (
        <span className="text-meta text-fg-muted tabular-nums">
          {f.number(r.ordersLast30Days)}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (r) => (
        <Badge tone={r.active ? 'success' : 'neutral'} size="sm">
          {r.active ? t('statusActive') : t('statusInactive')}
        </Badge>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <>
            <GuardedButton
              permission="catalog.edit"
              variant="primary"
              onClick={() => setCreating(true)}
            >
              <PlusIcon strokeWidth={2.5} />
              {t('newTest')}
            </GuardedButton>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={t('searchPlaceholder')}
          aria-label={tc('search')}
          className="[&_input]:h-11 [&_input]:text-base"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterTabs
            value={status}
            onValueChange={setStatus}
            aria-label={t('filterStatus')}
            items={[
              {
                value: 'active',
                label: t('tabActive'),
                count: tests.filter((x) => x.active).length,
              },
              {
                value: 'inactive',
                label: t('tabInactive'),
                count: tests.filter((x) => !x.active).length,
              },
              { value: 'all', label: t('tabAll'), count: tests.length },
            ]}
          />
          <Select
            size="sm"
            className="ml-auto w-48"
            aria-label={t('filterDepartment')}
            value={department}
            onValueChange={setDepartment}
            options={[
              { value: 'all' as const, label: t('anyDepartment') },
              ...DEPARTMENTS.map((d) => ({
                value: d,
                label: e('department', d),
              })),
            ]}
          />
          <Select
            size="sm"
            className="w-48"
            aria-label={t('filterSpecimen')}
            value={specimen}
            onValueChange={setSpecimen}
            options={[
              { value: 'all' as const, label: t('anySpecimen') },
              ...SPECIMENS.map((s) => ({ value: s, label: e('specimen', s) })),
            ]}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <DataTable
          caption={t('title')}
          columns={columns}
          rows={data}
          getRowId={(r) => r.id}
          rowLabel={(r) => r.name}
          onRowClick={(r) => setOpen(r.id)}
          activeRowId={openId}
          isLoading={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          pageSize={20}
          minWidth={980}
          rowClassName={(r) => (r.active ? undefined : 'opacity-70')}
          empty={
            <EmptyState
              icon={<LibraryIcon />}
              tone="green"
              title={t('emptyTitle')}
              description={t('emptyBody')}
            />
          }
        />
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-subtle">
        <InfoIcon className="size-3.5" />
        {t('newOrdersOnlyBody')}
      </p>

      {openId ? <TestDrawer id={openId} onClose={closeOpen} /> : null}
      {creating ? (
        <TestFormDialog
          onClose={() => setCreating(false)}
          onSaved={(id) => setOpen(id)}
        />
      ) : null}
    </>
  )
}
