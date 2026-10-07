import {
  PlusIcon,
  ThermometerIcon,
  ThermometerSnowflakeIcon,
} from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/app/layout/page-header'
import { DEPARTMENT_ICONS } from '@/app/layout/nav-config'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam, useUrlFilters } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { DEPARTMENT_TONES } from '@/lib/icon-tones'
import type { ColdUnitRow } from '@/services/lab-api'
import { useColdUnits } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { IconGlyph } from '@/components/ui/icon-tile'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { Button } from '@/components/ui/button'
import { OverdueBadge, RangeBadge } from './cold-status'
import { ColdUnitDialog } from './cold-unit-dialog'
import { ColdUnitDrawer } from './cold-unit-drawer'
import { useTemperature } from './cold-utils'
import { LogReadingDialog } from './log-reading-dialog'

const SHOW = ['all', 'attention'] as const
type Show = (typeof SHOW)[number]

const needsAttention = (u: ColdUnitRow) =>
  u.readingOverdue || u.latest?.outOfRange === true

type Editing = { unit?: ColdUnitRow } | null

export function Component() {
  const t = useT('coldStorage')
  const f = useFormat()
  const now = useNow()
  const temp = useTemperature()
  const filters = useUrlFilters({ show: 'all' }, { show: SHOW })
  const show = filters.values.show as Show
  const { data, isPending, isError, refetch, dataUpdatedAt } = useColdUnits()
  const [editingState, setEditing] = useState<Editing>(null)
  const [logging, setLogging] = useState<ColdUnitRow | null>(null)

  const [openId, openUnitId, closeUnit] = useOverlayParam('unit')
  // ?new=1 opens the add-unit form (the button and the command palette).
  const [newParam, openNew, closeNew] = useOverlayParam('new')
  const editing: Editing = editingState ?? (newParam === '1' ? {} : null)
  const closeEditing = () => {
    if (editingState !== null) setEditing(null)
    else closeNew()
  }

  const units = data ?? []
  const rows = show === 'attention' ? units.filter(needsAttention) : units
  const openUnit = openId ? units.find((u) => u.id === openId) : undefined
  // A dialog shows the unit's current figures, not the copy it opened with.
  const fresh = (u: ColdUnitRow) => units.find((x) => x.id === u.id) ?? u
  const outNow = units.filter((u) => u.latest?.outOfRange).length
  const excursions = units.reduce((n, u) => n + u.excursions7d, 0)
  const overdue = units.filter((u) => u.readingOverdue).length
  const attention = units.filter(needsAttention).length

  const columns: Column<ColdUnitRow>[] = [
    {
      id: 'name',
      header: t('colUnit'),
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-meta font-medium text-fg">{r.name}</p>
          <p className="truncate text-xs text-fg-muted">
            {t(`kind.${r.kind}`)} · {r.location}
          </p>
        </div>
      ),
    },
    {
      id: 'department',
      header: t('colDepartment'),
      tabletHidden: true,
      sortValue: (r) => temp.department(r.department),
      cell: (r) => (
        <span className="inline-flex items-center gap-2 text-meta whitespace-nowrap text-fg">
          {r.department === 'all' ? null : (
            <IconGlyph
              icon={DEPARTMENT_ICONS[r.department]}
              tone={DEPARTMENT_TONES[r.department]}
              size={16}
            />
          )}
          {temp.department(r.department)}
        </span>
      ),
    },
    {
      id: 'range',
      header: t('colRange'),
      sortValue: (r) => r.min,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {temp.range(r.min, r.max)}
        </span>
      ),
    },
    {
      id: 'latest',
      header: t('colLatest'),
      // The reading itself; units never read sort last.
      sortValue: (r) => r.latest?.value,
      cell: (r) =>
        r.latest ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-16 text-meta font-semibold text-fg tabular-nums">
              {temp.temp(r.latest.value)}
            </span>
            <RangeBadge outOfRange={r.latest.outOfRange} />
          </span>
        ) : (
          <RangeBadge outOfRange={undefined} />
        ),
    },
    {
      id: 'lastRead',
      header: t('colLastRead'),
      sortValue: (r) => r.latest?.at,
      cell: (r) => (
        <div className="grid justify-items-start gap-1">
          {r.latest ? (
            <span className="text-xs text-fg-muted">
              {t('readAtBy', {
                time: f.relative(r.latest.at, now),
                name: r.latest.byName,
              })}
            </span>
          ) : null}
          {r.readingOverdue ? <OverdueBadge /> : null}
        </div>
      ),
    },
    {
      id: 'excursions',
      header: t('colExcursions'),
      tabletHidden: true,
      align: 'right',
      sortValue: (r) => r.excursions7d,
      cell: (r) =>
        r.excursions7d > 0 ? (
          <span className="text-meta font-medium whitespace-nowrap text-danger-text tabular-nums">
            {t('excursions', { count: r.excursions7d })}
          </span>
        ) : (
          <span className="text-meta text-fg-subtle">{t('noExcursions')}</span>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('colActions')}</span>,
      align: 'right',
      cell: (r) => (
        <div
          className="flex justify-end"
          onClick={(ev) => ev.stopPropagation()}
        >
          <GuardedButton
            permission="quality.record"
            size="xs"
            variant="secondary"
            onClick={() => setLogging(r)}
          >
            <ThermometerIcon />
            {t('logReading')}
            <span className="sr-only">: {r.name}</span>
          </GuardedButton>
        </div>
      ),
    },
  ]

  const dialogs = (
    <>
      {editing ? (
        <ColdUnitDialog
          unit={editing.unit ? fresh(editing.unit) : undefined}
          onClose={closeEditing}
        />
      ) : null}
      {logging ? (
        <LogReadingDialog
          unit={fresh(logging)}
          onClose={() => setLogging(null)}
        />
      ) : null}
    </>
  )

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
          <GuardedButton
            permission="equipment.manage"
            variant="primary"
            onClick={() => openNew('1')}
          >
            <PlusIcon />
            {t('addUnit')}
          </GuardedButton>
        }
      />

      {isError ? (
        <Card>
          <ErrorState onRetry={() => void refetch()} />
        </Card>
      ) : (
        <>
          {isPending ? (
            <Skeleton className="mb-5 h-[5.5rem] rounded-xl" />
          ) : (
            <MetricStrip
              className="mb-5"
              items={[
                {
                  key: 'units',
                  label: t('metricUnits'),
                  value: f.number(units.length),
                  detail: outNow
                    ? t('metricOutNow', { count: outNow })
                    : t('metricAllInRange'),
                  alert: outNow > 0,
                },
                {
                  key: 'excursions',
                  label: t('metricExcursions'),
                  value: f.number(excursions),
                  detail: t('metricExcursionsDetail'),
                  alert: excursions > 0,
                },
                {
                  key: 'overdue',
                  label: t('metricOverdue'),
                  value: f.number(overdue),
                  detail: t('metricOverdueDetail'),
                  alert: overdue > 0,
                },
              ]}
            />
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-line px-3 pt-2">
              <FilterTabs
                value={show}
                onValueChange={(v) => filters.set({ show: v })}
                aria-label={t('filterLabel')}
                items={[
                  {
                    value: 'all' as const,
                    label: t('filterAll'),
                    count: units.length,
                  },
                  {
                    value: 'attention' as const,
                    label: t('filterAttention'),
                    count: attention,
                    ...(attention ? { tone: 'danger' as const } : {}),
                  },
                ]}
              />
            </div>
            <DataTable
              caption={t('title')}
              columns={columns}
              rows={isPending ? undefined : rows}
              getRowId={(r) => r.id}
              rowLabel={(r) => r.name}
              onRowClick={(r) => openUnitId(r.id)}
              activeRowId={openId}
              isLoading={isPending}
              initialSort={{ id: 'name' }}
              rowClassName={(r) =>
                needsAttention(r) ? 'row-alert' : undefined
              }
              mobile={{
                primary: 'name',
                fields: ['latest', 'lastRead'],
                actions: 'actions',
              }}
              empty={
                show === 'attention' && units.length > 0 ? (
                  <EmptyState
                    icon={<ThermometerSnowflakeIcon />}
                    tone="green"
                    title={t('emptyFilteredTitle')}
                    description={t('emptyFilteredBody')}
                    action={
                      <Button onClick={() => filters.clear()}>
                        {t('showAll')}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<ThermometerSnowflakeIcon />}
                    tone="sky"
                    title={t('emptyTitle')}
                    description={t('emptyBody')}
                    action={
                      <GuardedButton
                        permission="equipment.manage"
                        variant="primary"
                        onClick={() => openNew('1')}
                      >
                        <PlusIcon />
                        {t('addUnit')}
                      </GuardedButton>
                    }
                  />
                )
              }
            />
          </Card>
        </>
      )}

      {openId ? (
        <ColdUnitDrawer
          unit={openUnit}
          isPending={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          onClose={closeUnit}
          onEdit={(u) => setEditing({ unit: u })}
          onLog={setLogging}
        >
          {dialogs}
        </ColdUnitDrawer>
      ) : (
        dialogs
      )}
    </>
  )
}
