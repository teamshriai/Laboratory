import { WrenchIcon } from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useDeferredValue, useState } from 'react'
import { useOverlayParam, useUrlFilters } from '@/hooks/use-search-param'
import { FilterBar } from '@/components/lab/filter-bar'
import { Select } from '@/components/ui/select'
import { DAY } from '@/domain/time'
import {
  DEPARTMENTS,
  EQUIPMENT_STATUSES,
  type DepartmentId,
  type EquipmentStatus,
} from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { DEPARTMENT_TONES } from '@/lib/icon-tones'
import { DEPARTMENT_ICONS } from '@/app/layout/nav-config'
import type { EquipmentRow } from '@/services/lab-api'
import { useEquipment } from '@/services/queries'
import {
  ConnectionBadge,
  EquipmentBadge,
  QcBadge,
} from '@/components/lab/status'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { IconGlyph } from '@/components/ui/icon-tile'
import { SearchInput } from '@/components/ui/input'
import { Meter } from '@/components/ui/misc'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { DueText, EquipmentDrawer } from './equipment-drawer'

export function Component() {
  const t = useT('equipment')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const filters = useUrlFilters(
    { status: 'all', department: 'all' },
    {
      status: ['all', ...EQUIPMENT_STATUSES],
      department: ['all', ...DEPARTMENTS],
    },
  )
  const status = filters.values.status as EquipmentStatus | 'all'
  const department = filters.values.department as DepartmentId | 'all'
  const setStatus = (v: EquipmentStatus | 'all') => filters.set({ status: v })
  const all = useEquipment({})
  const {
    data: statusRows,
    isPending,
    isError,
    refetch,
  } = useEquipment({ q, status })
  const data =
    department === 'all'
      ? statusRows
      : statusRows?.filter((r) => r.department === department)
  const [openId, setOpen, closeOpen] = useOverlayParam('equipment')

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  const rows = all.data ?? []
  const up = rows.filter((r) => r.effectiveStatus === 'operational').length
  const overdue = rows.filter(
    (r) => r.maintenanceOverdue || r.calibrationOverdue,
  ).length
  const due7 = rows.filter(
    (r) =>
      (!r.maintenanceOverdue && r.nextMaintenanceAt - now <= 7 * DAY) ||
      (!r.calibrationOverdue && r.calibrationDueAt - now <= 7 * DAY),
  ).length
  const columns: Column<EquipmentRow>[] = [
    {
      id: 'name',
      header: t('colName'),
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-meta font-medium text-fg">{r.name}</p>
          <p className="truncate text-xs text-fg-muted">
            {r.manufacturer} {r.model} · {r.location}
          </p>
        </div>
      ),
    },
    {
      id: 'department',
      header: t('department'),
      sortValue: (r) => DEPARTMENTS.indexOf(r.department),
      cell: (r) => (
        <span className="inline-flex items-center gap-2 text-meta whitespace-nowrap text-fg">
          <IconGlyph
            icon={DEPARTMENT_ICONS[r.department]}
            tone={DEPARTMENT_TONES[r.department]}
            size={16}
          />
          {e('department', r.department)}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('currentStatus'),
      sortValue: (r) => EQUIPMENT_STATUSES.indexOf(r.effectiveStatus),
      cell: (r) => (
        <div className="grid justify-items-start gap-1">
          <span className="flex flex-wrap items-center gap-1">
            <EquipmentBadge status={r.effectiveStatus} size="sm" />
            <ConnectionBadge connection={r.connection} size="sm" />
          </span>
          {r.openQcEvents ? (
            <span className="text-2xs font-semibold text-danger-text">
              {t('openQc', { count: r.openQcEvents })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'utilization',
      tabletHidden: true,
      header: t('utilization'),
      sortValue: (r) => r.utilizationPct,
      cell: (r) =>
        r.effectiveStatus === 'out-of-service' ? (
          <span className="text-xs text-fg-subtle">-</span>
        ) : (
          <div className="w-28">
            <p className="text-xs text-fg tabular-nums">
              {f.percent(r.utilizationPct / 100)}
              <span className="ml-1.5 text-fg-subtle">
                {t('testsToday', { count: r.testsToday })}
              </span>
            </p>
            <Meter value={r.utilizationPct} max={100} className="mt-1" />
          </div>
        ),
    },
    {
      id: 'qc',
      header: t('qcToday'),
      cell: (r) =>
        r.qcToday === 'none' ? (
          <span className="text-xs text-fg-subtle">{t('qcNone')}</span>
        ) : (
          <QcBadge result={r.qcToday} size="sm" />
        ),
    },
    {
      id: 'maintenance',
      tabletHidden: true,
      header: t('maintenance'),
      sortValue: (r) => r.nextMaintenanceAt,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap">
          <DueText at={r.nextMaintenanceAt} now={now} />
        </span>
      ),
    },
    {
      id: 'calibration',
      header: t('calibration'),
      sortValue: (r) => r.calibrationDueAt,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap">
          <DueText at={r.calibrationDueAt} now={now} />
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          <>
            {all.dataUpdatedAt ? (
              <span className="text-xs text-fg-muted">
                {t('updated', { time: f.time(all.dataUpdatedAt) })}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta">
              <span className="inline-flex items-center gap-1.5 text-fg">
                <span aria-hidden className="size-2 rounded-full bg-success" />
                {t('running', { up, total: rows.length })}
              </span>
              {overdue ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-danger-text">
                  <span aria-hidden className="size-2 rounded-full bg-danger" />
                  {t('overdueCount', { count: overdue })}
                </span>
              ) : null}
              {due7 ? (
                <span className="inline-flex items-center gap-1.5 text-warning-text">
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-warning"
                  />
                  {t('due7', { count: due7 })}
                </span>
              ) : null}
            </div>
          </>
        }
      />

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-line px-3 pt-2">
          <FilterTabs
            value={status}
            onValueChange={setStatus}
            className="md:flex-wrap md:overflow-visible"
            aria-label={tc('status')}
            items={[
              { value: 'all' as const, label: tc('all'), count: rows.length },
              ...EQUIPMENT_STATUSES.map((s) => ({
                value: s,
                label: e('equipmentStatus', s),
                count: rows.filter((r) => r.effectiveStatus === s).length,
                ...(s === 'out-of-service' ? { tone: 'danger' as const } : {}),
              })),
            ]}
          />
        </div>
        <FilterBar
          canClear={department !== 'all' || query !== ''}
          onClear={() => {
            setQuery('')
            filters.clear(['department'])
          }}
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
            className="w-full sm:w-48"
            aria-label={t('department')}
            value={department}
            onValueChange={(v) => filters.set({ department: v })}
            options={[
              { value: 'all', label: tc('allDepartments') },
              ...DEPARTMENTS.map((d) => ({
                value: d,
                label: e('department', d),
              })),
            ]}
          />
        </FilterBar>
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
          initialSort={{ id: 'department' }}
          pageSize={30}
          minWidth={980}
          rowClassName={(r) =>
            r.effectiveStatus === 'out-of-service' || r.openQcEvents > 0
              ? 'shadow-[inset_3px_0_0_var(--danger)]'
              : undefined
          }
          mobile={{ primary: 'name', fields: ['status', 'maintenance'] }}
          empty={
            <EmptyState
              icon={<WrenchIcon />}
              tone="slate"
              title={t('emptyTitle')}
              description={t('emptyBody')}
            />
          }
        />
      </Card>
      {openId ? <EquipmentDrawer id={openId} onClose={closeOpen} /> : null}
    </>
  )
}
