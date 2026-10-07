import { ClipboardCheckIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { NC_STATES } from '@/domain/types'
import { useOverlayParam, useUrlFilters } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { NcRow } from '@/services/lab-api'
import { useNcs } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { NcDrawer } from './nc-drawer'
import { NC_FILTERS, type NcFilter } from './quality'
import { NcStateBadge, OverdueText, SeverityText } from './quality-badges'
import { RaiseNcDialog } from './raise-nc-dialog'

const matches = (filter: NcFilter) => (n: NcRow) =>
  filter === 'all'
    ? true
    : filter === 'active'
      ? n.state !== 'closed'
      : n.state === filter

export function CapaPanel() {
  const t = useT('quality')
  const f = useFormat()
  const { data, isPending, isError, refetch } = useNcs()
  const filters = useUrlFilters<{ state: NcFilter }>(
    { state: 'active' },
    {
      state: NC_FILTERS,
    },
  )
  const filter = filters.values.state
  const [ncId, openNc, closeNc] = useOverlayParam('nc')
  const [raising, setRaising] = useState(false)
  const rows = data?.filter(matches(filter))
  const count = (k: NcFilter) => data?.filter(matches(k)).length

  const columns: Column<NcRow>[] = [
    {
      id: 'nc',
      header: t('ncCol'),
      sortValue: (n) => n.ncNo,
      cell: (n) => (
        <div className="max-w-96 min-w-0">
          <p className="font-mono text-xs font-medium whitespace-nowrap text-fg">
            {n.ncNo}
          </p>
          <p className="truncate text-meta text-fg">{n.title}</p>
        </div>
      ),
    },
    {
      id: 'severity',
      header: t('ncSeverityField'),
      sortValue: (n) =>
        n.severity === 'critical' ? 3 : n.severity === 'major' ? 2 : 1,
      cell: (n) => <SeverityText severity={n.severity} />,
    },
    {
      id: 'source',
      header: t('ncSourceField'),
      tabletHidden: true,
      cell: (n) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {t(`ncSource.${n.source}`)}
        </span>
      ),
    },
    {
      id: 'owner',
      header: t('ncOwner'),
      sortValue: (n) => n.ownerName ?? '',
      cell: (n) =>
        n.ownerName ? (
          <span className="text-meta whitespace-nowrap text-fg">
            {n.ownerName}
          </span>
        ) : (
          <span className="text-meta whitespace-nowrap text-fg-subtle">
            {t('notAssigned')}
          </span>
        ),
    },
    {
      id: 'due',
      header: t('ncDue'),
      sortValue: (n) => n.dueAt ?? null,
      cell: (n) =>
        n.dueAt ? (
          <div className="grid gap-0.5">
            <span className="text-meta whitespace-nowrap text-fg">
              {f.date(n.dueAt)}
            </span>
            {n.overdue ? <OverdueText /> : null}
          </div>
        ) : (
          <span className="text-meta text-fg-subtle">-</span>
        ),
    },
    {
      id: 'raised',
      header: t('ncRaisedCol'),
      tabletHidden: true,
      sortValue: (n) => n.raisedAt,
      cell: (n) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {f.date(n.raisedAt)}
        </span>
      ),
    },
    {
      id: 'state',
      header: t('stateCol'),
      sortValue: (n) => NC_STATES.indexOf(n.state),
      cell: (n) => <NcStateBadge state={n.state} />,
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<ClipboardCheckIcon />}
        tone="amber"
        title={t('capaTitle')}
        description={t('capaDescription')}
        action={
          <GuardedButton
            permission="quality.record"
            variant="primary"
            onClick={() => setRaising(true)}
          >
            <PlusIcon strokeWidth={2.5} />
            {t('raiseNc')}
          </GuardedButton>
        }
      />
      <div className="border-b border-line px-3">
        <FilterTabs
          aria-label={t('ncFilterLabel')}
          value={filter}
          onValueChange={(v) => filters.set({ state: v })}
          items={NC_FILTERS.map((k) => ({
            value: k,
            label: t(`ncFilter.${k}`),
            ...(count(k) !== undefined ? { count: count(k) } : {}),
          }))}
        />
      </div>
      <DataTable
        caption={t('capaTitle')}
        columns={columns}
        rows={rows}
        getRowId={(n) => n.id}
        isLoading={isPending}
        isError={isError}
        onRetry={() => void refetch()}
        pageSize={50}
        onRowClick={(n) => openNc(n.id)}
        rowLabel={(n) => `${n.ncNo} ${n.title}`}
        activeRowId={ncId}
        rowClassName={(n) => (n.overdue ? 'row-alert' : undefined)}
        mobile={{
          primary: 'nc',
          fields: ['state', 'severity', 'owner', 'due'],
        }}
        empty={
          <EmptyState
            icon={<ClipboardCheckIcon />}
            tone="green"
            title={t('ncEmpty')}
            description={
              filter === 'all' ? t('ncEmptyAllBody') : t('ncEmptyBody')
            }
          />
        }
      />
      {ncId ? <NcDrawer ncId={ncId} onClose={closeNc} /> : null}
      {raising ? (
        <RaiseNcDialog
          onClose={() => setRaising(false)}
          onRaised={(id) => {
            setRaising(false)
            openNc(id)
          }}
        />
      ) : null}
    </Card>
  )
}
