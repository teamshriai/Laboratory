import {
  MapPinnedIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  SnowflakeIcon,
} from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { CENTRE_KINDS, type CollectionCentre } from '@/domain/types'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import type { NetworkMasters } from '@/services/lab-api'
import { FilterBar } from '@/components/lab/filter-bar'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { CentreDialog } from './centre-dialog'
import { ActiveBadge } from './doctors-panel'

type Row = NetworkMasters['centres'][number]

const STATUSES = ['active', 'inactive', 'all'] as const
const KINDS = ['all', ...CENTRE_KINDS] as const
const DEFAULTS = { q: '', status: 'active', kind: 'all' }

/** Collection centres (NABL 111): licence, in-charge, transit, cold chain. */
export function CentresPanel({
  centres,
  isPending,
  isError,
  onRetry,
}: {
  centres: Row[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('network')
  const tc = useT('common')
  const e = useEnum()
  const url = useUrlFilters(DEFAULTS, { status: STATUSES, kind: KINDS })
  const status = url.values.status as (typeof STATUSES)[number]
  const kind = url.values.kind as (typeof KINDS)[number]
  const q = useDeferredValue(url.values.q).trim().toLowerCase()
  const [editing, setEditing] = useState<CollectionCentre | 'new' | null>(null)

  const searched = (centres ?? []).filter(
    (c) =>
      (kind === 'all' || c.kind === kind) &&
      (!q ||
        [
          c.code,
          c.name,
          c.city,
          c.pinCode,
          c.inchargeName,
          c.licenceNo,
          c.accountName,
        ].some((v) => v?.toLowerCase().includes(q))),
  )
  const rows = centres
    ? searched.filter(
        (c) => status === 'all' || (status === 'active') === c.active,
      )
    : undefined
  const filtered = url.activeCount(['q', 'kind']) > 0
  const takenCodes = (exceptId?: string) =>
    (centres ?? []).filter((c) => c.id !== exceptId).map((c) => c.code)

  const columns: Column<Row>[] = [
    {
      id: 'centre',
      header: t('colCentre'),
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="min-w-0">
          <p className="text-meta font-medium text-fg">{c.name}</p>
          <p className="text-xs text-fg-muted">
            <span className="font-mono">{c.code}</span> ·{' '}
            {e('centreKind', c.kind)}
          </p>
        </div>
      ),
    },
    {
      id: 'location',
      header: t('colLocation'),
      sortValue: (c) => c.city,
      cell: (c) => (
        <div className="min-w-0">
          <p className="text-meta whitespace-nowrap text-fg">
            {c.city}{' '}
            <span className="text-fg-muted tabular-nums">{c.pinCode}</span>
          </p>
          {c.address ? (
            <p className="line-clamp-1 max-w-56 text-xs text-fg-muted">
              {c.address}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'incharge',
      header: t('colIncharge'),
      sortValue: (c) => c.inchargeName,
      cell: (c) => (
        <div className="min-w-0">
          <p className="text-meta text-fg">{c.inchargeName}</p>
          {c.inchargeQualification ? (
            <p className="text-xs text-fg-muted">{c.inchargeQualification}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'licence',
      header: t('colLicence'),
      tabletHidden: true,
      cell: (c) =>
        c.licenceNo ? (
          <span className="font-mono text-meta whitespace-nowrap text-fg-muted">
            {c.licenceNo}
          </span>
        ) : (
          <span className="text-meta text-warning-text">
            {t('licenceMissing')}
          </span>
        ),
    },
    {
      id: 'hours',
      header: t('colHours'),
      tabletHidden: true,
      cell: (c) => (
        <span className="line-clamp-2 max-w-48 text-meta text-fg-muted">
          {c.hours || '-'}
        </span>
      ),
    },
    {
      id: 'transit',
      header: t('colTransit'),
      align: 'right',
      sortValue: (c) => c.transitMin,
      cell: (c) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {t('minutesValue', { count: c.transitMin })}
        </span>
      ),
    },
    {
      id: 'coldChain',
      header: t('colColdChain'),
      sortValue: (c) => (c.coldChain ? 0 : 1),
      cell: (c) => (
        <span className="inline-flex items-center gap-1.5 text-meta whitespace-nowrap text-fg">
          {c.coldChain ? (
            <SnowflakeIcon
              className="size-4 shrink-0 text-info-text"
              aria-hidden
            />
          ) : (
            <MinusIcon className="size-4 shrink-0 text-fg-subtle" aria-hidden />
          )}
          {c.coldChain ? t('coldChainYes') : t('coldChainNo')}
        </span>
      ),
    },
    {
      id: 'account',
      header: t('colAccount'),
      tabletHidden: true,
      sortValue: (c) => c.accountName ?? '',
      cell: (c) => (
        <span className="text-meta text-fg-muted">
          {c.accountName ?? t('noAccountShort')}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      sortValue: (c) => (c.active ? 0 : 1),
      cell: (c) => <ActiveBadge active={c.active} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      cell: (c) => (
        <GuardedButton
          permission="masters.manage"
          size="xs"
          variant="secondary"
          aria-label={t('editNamed', { name: c.name })}
          onClick={() => setEditing(c)}
        >
          <PencilIcon aria-hidden />
          {tc('edit')}
        </GuardedButton>
      ),
    },
  ]

  return (
    <>
      <p className="mb-4 flex max-w-4xl items-start gap-2 rounded-lg bg-info-soft p-3 text-meta text-info-text">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('nablNote')}
      </p>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 pt-1">
          <FilterTabs
            value={status}
            onValueChange={(v) => url.set({ status: v })}
            aria-label={t('filterStatus')}
            items={[
              {
                value: 'active',
                label: t('tabActive'),
                count: searched.filter((c) => c.active).length,
              },
              {
                value: 'inactive',
                label: t('tabInactive'),
                count: searched.filter((c) => !c.active).length,
              },
              { value: 'all', label: t('tabAll'), count: searched.length },
            ]}
          />
          <GuardedButton
            permission="masters.manage"
            variant="primary"
            size="sm"
            className="my-1.5"
            onClick={() => setEditing('new')}
          >
            <PlusIcon strokeWidth={2.5} aria-hidden />
            {t('addCentre')}
          </GuardedButton>
        </div>
        <FilterBar canClear={filtered} onClear={() => url.clear(['q', 'kind'])}>
          <SearchInput
            value={url.values.q}
            onValueChange={(v) => url.set({ q: v })}
            placeholder={t('searchCentres')}
            aria-label={tc('search')}
            clearLabel={t('clearSearch')}
            className="w-full sm:w-96"
          />
          <Select
            size="sm"
            aria-label={t('filterKind')}
            value={kind}
            onValueChange={(v) => url.set({ kind: v })}
            options={[
              { value: 'all' as const, label: t('kindAll') },
              ...CENTRE_KINDS.map((k) => ({
                value: k,
                label: e('centreKind', k),
              })),
            ]}
            className="w-full sm:w-52"
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('centresTitle')}
            columns={columns}
            rows={rows}
            getRowId={(c) => c.id}
            isLoading={isPending}
            isError={isError}
            onRetry={onRetry}
            pageSize={25}
            initialSort={{ id: 'centre' }}
            rowClassName={(c) => (c.active ? undefined : 'opacity-75')}
            mobile={{
              primary: 'centre',
              fields: ['location', 'incharge', 'coldChain', 'status'],
              actions: 'actions',
            }}
            empty={
              <EmptyState
                icon={<MapPinnedIcon />}
                tone="teal"
                title={
                  filtered ? t('centresEmptyFiltered') : t('centresEmptyTitle')
                }
                description={
                  filtered ? t('emptyFilteredBody') : t('centresEmptyBody')
                }
                action={
                  filtered ? (
                    <Button
                      variant="secondary"
                      onClick={() => url.clear(['q', 'kind'])}
                    >
                      {tc('clearFilters')}
                    </Button>
                  ) : null
                }
              />
            }
          />
        </div>
      </Card>
      {editing ? (
        <CentreDialog
          centre={editing === 'new' ? undefined : editing}
          takenCodes={takenCodes(editing === 'new' ? undefined : editing.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}
