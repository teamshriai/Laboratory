import {
  BuildingIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  HospitalIcon,
  PencilIcon,
  PlusIcon,
  StethoscopeIcon,
} from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import type { Doctor } from '@/domain/types'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { NetworkMasters } from '@/services/lab-api'
import { FilterBar } from '@/components/lab/filter-bar'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { DoctorDialog } from './doctor-dialog'

type Row = NetworkMasters['doctors'][number]

const STATUSES = ['active', 'inactive', 'all'] as const
const REFERRERS = ['all', 'internal', 'outside'] as const
const DEFAULTS = { q: '', status: 'active', referrer: 'all' }

/** Referring doctors: the lab's own clinicians and outside referrers. */
export function DoctorsPanel({
  doctors,
  isPending,
  isError,
  onRetry,
}: {
  doctors: Row[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('network')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const url = useUrlFilters(DEFAULTS, {
    status: STATUSES,
    referrer: REFERRERS,
  })
  const status = url.values.status as (typeof STATUSES)[number]
  const referrer = url.values.referrer as (typeof REFERRERS)[number]
  const q = useDeferredValue(url.values.q).trim().toLowerCase()
  const [editing, setEditing] = useState<Doctor | 'new' | null>(null)

  const isActive = (d: Row) => d.active !== false
  const byReferrer = (doctors ?? []).filter(
    (d) =>
      referrer === 'all' || (referrer === 'outside') === Boolean(d.external),
  )
  const matches = (d: Row) =>
    !q ||
    [
      d.name,
      d.specialty,
      d.qualification,
      d.registrationNo,
      d.phone,
      d.clinic,
      d.email,
      e('clinicalDepartment', d.department),
    ].some((v) => v?.toLowerCase().includes(q))
  const searched = byReferrer.filter(matches)
  const rows = doctors
    ? searched.filter(
        (d) => status === 'all' || (status === 'active') === isActive(d),
      )
    : undefined
  const filtered = url.activeCount(['q', 'referrer']) > 0

  const columns: Column<Row>[] = [
    {
      id: 'name',
      header: t('colDoctor'),
      sortValue: (d) => d.name,
      cell: (d) => (
        <div className="min-w-0">
          <p className="text-meta font-medium text-fg">{d.name}</p>
          <p className="text-xs text-fg-muted">
            {e('clinicalDepartment', d.department)}
          </p>
        </div>
      ),
    },
    {
      id: 'specialty',
      header: t('colSpecialty'),
      sortValue: (d) => d.specialty ?? '',
      cell: (d) => (
        <span className="text-meta text-fg">{d.specialty ?? '-'}</span>
      ),
    },
    {
      id: 'qualification',
      header: t('colQualification'),
      tabletHidden: true,
      cell: (d) => (
        <span className="text-meta text-fg-muted">
          {d.qualification || '-'}
        </span>
      ),
    },
    {
      id: 'registration',
      header: t('colRegistration'),
      tabletHidden: true,
      cell: (d) => (
        <span className="font-mono text-meta whitespace-nowrap text-fg-muted">
          {d.registrationNo ?? '-'}
        </span>
      ),
    },
    {
      id: 'phone',
      header: t('colPhone'),
      cell: (d) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {d.phone}
        </span>
      ),
    },
    {
      id: 'referrer',
      header: t('colReferrer'),
      sortValue: (d) => (d.external ? 1 : 0),
      cell: (d) => (
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-meta whitespace-nowrap text-fg">
            {d.external ? (
              <BuildingIcon
                className="size-4 shrink-0 text-fg-muted"
                aria-hidden
              />
            ) : (
              <HospitalIcon
                className="size-4 shrink-0 text-fg-muted"
                aria-hidden
              />
            )}
            {d.external ? t('referrerOutside') : t('referrerInternal')}
          </span>
          {d.external && d.clinic ? (
            <p className="text-xs text-fg-muted">{d.clinic}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'orders',
      header: t('colOrders30d'),
      align: 'right',
      sortValue: (d) => d.orders30d,
      cell: (d) => (
        <span className="text-meta text-fg tabular-nums">
          {f.number(d.orders30d)}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      sortValue: (d) => (isActive(d) ? 0 : 1),
      cell: (d) => <ActiveBadge active={isActive(d)} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      cell: (d) => (
        <GuardedButton
          permission="masters.manage"
          size="xs"
          variant="secondary"
          aria-label={t('editNamed', { name: d.name })}
          onClick={() => setEditing(d)}
        >
          <PencilIcon aria-hidden />
          {tc('edit')}
        </GuardedButton>
      ),
    },
  ]

  return (
    <>
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
                count: searched.filter(isActive).length,
              },
              {
                value: 'inactive',
                label: t('tabInactive'),
                count: searched.filter((d) => !isActive(d)).length,
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
            {t('addDoctor')}
          </GuardedButton>
        </div>
        <FilterBar
          canClear={filtered}
          onClear={() => url.clear(['q', 'referrer'])}
        >
          <SearchInput
            value={url.values.q}
            onValueChange={(v) => url.set({ q: v })}
            placeholder={t('searchDoctors')}
            aria-label={tc('search')}
            clearLabel={t('clearSearch')}
            className="w-full sm:w-96"
          />
          <Select
            size="sm"
            aria-label={t('filterReferrer')}
            value={referrer}
            onValueChange={(v) => url.set({ referrer: v })}
            options={[
              { value: 'all' as const, label: t('referrerAll') },
              { value: 'internal' as const, label: t('referrerInternal') },
              { value: 'outside' as const, label: t('referrerOutside') },
            ]}
            className="w-full sm:w-52"
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('doctorsTitle')}
            columns={columns}
            rows={rows}
            getRowId={(d) => d.id}
            isLoading={isPending}
            isError={isError}
            onRetry={onRetry}
            pageSize={25}
            initialSort={{ id: 'name' }}
            rowClassName={(d) => (isActive(d) ? undefined : 'opacity-75')}
            mobile={{
              primary: 'name',
              fields: ['referrer', 'phone', 'status'],
              actions: 'actions',
            }}
            empty={
              <EmptyState
                icon={<StethoscopeIcon />}
                tone="teal"
                title={
                  filtered ? t('doctorsEmptyFiltered') : t('doctorsEmptyTitle')
                }
                description={
                  filtered ? t('emptyFilteredBody') : t('doctorsEmptyBody')
                }
                action={
                  filtered ? (
                    <Button
                      variant="secondary"
                      onClick={() => url.clear(['q', 'referrer'])}
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
        <DoctorDialog
          doctor={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

/** Active or inactive, with an icon and words. */
export function ActiveBadge({ active }: { active: boolean }) {
  const t = useT('network')
  return active ? (
    <Badge size="sm" tone="success">
      <CircleCheckIcon aria-hidden />
      {t('statusActive')}
    </Badge>
  ) : (
    <Badge size="sm" tone="neutral">
      <CircleSlashIcon aria-hidden />
      {t('statusInactive')}
    </Badge>
  )
}
