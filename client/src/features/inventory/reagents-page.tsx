import { useSearchParam } from '@/hooks/use-search-param'
import { FlaskConicalIcon, PackageIcon } from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useDeferredValue, useState } from 'react'
import { useSearchParams } from 'react-router'
import { DEPARTMENTS, type DepartmentId } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { LotRow } from '@/services/lab-api'
import { useLots, useReagents } from '@/services/queries'
import { StockBadge } from '@/components/lab/status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { InventoryItemDrawer, LotMenu } from './item-drawer'
import { LotActionDialogs } from './lot-dialogs'
import { ReceiveLotDialog } from './receive-lot-dialog'
import { roundQty, type LotAction } from './stock'
import { ExpiryText, LevelBar, QcLotBadge, StorageLabel } from './stock-widgets'
import { focusWhenScrollable } from '@/lib/scroll-focus'

const FILTERS = [
  'all',
  'available',
  'low-stock',
  'expiring-soon',
  'expired',
  'quarantined',
  'qc-failed',
] as const
type Filter = (typeof FILTERS)[number]

function lotMatches(l: LotRow, f: Filter) {
  switch (f) {
    case 'all':
      return l.state !== 'disposed' && l.state !== 'depleted'
    case 'available':
      return l.state === 'active' && l.status === 'in-stock'
    case 'qc-failed':
      return l.qcStatus === 'failed'
    default:
      return l.status === f && l.state !== 'disposed'
  }
}

const DEPARTMENT_FILTER = ['all', ...DEPARTMENTS] as const

export function Component() {
  const t = useT('inventory')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const [filter, setFilter] = useState<Filter>('all')
  const [department, setDepartment] = useSearchParam<DepartmentId | 'all'>(
    'department',
    'all',
    DEPARTMENT_FILTER,
  )
  const [action, setAction] = useState<LotAction | null>(null)
  const [receivingState, setReceiving] = useState<string | null>(null)
  const reagents = useReagents()
  const lots = useLots({ q, ...(department !== 'all' ? { department } : {}) })
  const focusLot = params.get('lot')
  const openReagent = params.get('reagent')
  const setParam = (key: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === null) next.delete(key)
      else next.set(key, value)
      return next
    })
  // ?new=1 opens the receive form directly (the command palette links here).
  const receiving = receivingState ?? (params.get('new') === '1' ? '' : null)
  const closeReceiving = () => {
    setReceiving(null)
    if (params.has('new')) setParam('new', null)
  }

  if (reagents.isError || lots.isError)
    return <ErrorState onRetry={() => void lots.refetch()} />
  const allLots = lots.data ?? []
  const counts = Object.fromEntries(
    FILTERS.map((x) => [x, allLots.filter((l) => lotMatches(l, x)).length]),
  ) as Record<Filter, number>
  const visible = allLots.filter(
    (l) => lotMatches(l, filter) || l.id === focusLot,
  )
  const groups = (reagents.data ?? [])
    .map((r) => ({
      reagent: r,
      lots: visible
        .filter((l) => l.reagentId === r.id)
        .toSorted((a, b) => a.expiresAt - b.expiresAt),
    }))
    .filter((g) => g.lots.length > 0)
    .toSorted((a, b) => a.reagent.name.localeCompare(b.reagent.name))

  return (
    <>
      <PageHeader
        title={t('reagentsTitle')}
        meta={
          <>
            {lots.dataUpdatedAt ? (
              <span className="text-xs text-fg-muted">
                {t('updated', { time: f.time(lots.dataUpdatedAt) })}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Button variant="primary" onClick={() => setReceiving('')}>
              <PackageIcon />
              {t('receiveLotTitle')}
            </Button>
          </>
        }
      />
      <Card className="mb-4 overflow-hidden">
        <div className="border-b border-line px-3 pt-2">
          <FilterTabs
            value={filter}
            onValueChange={setFilter}
            className="md:flex-wrap md:overflow-visible"
            aria-label={t('colStatus')}
            items={FILTERS.map((x) => ({
              value: x,
              label:
                x === 'all'
                  ? tc('all')
                  : x === 'available'
                    ? t('lotStatusAvailable')
                    : x === 'qc-failed'
                      ? t('lotStatusQcFailed')
                      : e('stockStatus', x),
              count: counts[x],
              ...(x === 'expired' || x === 'qc-failed'
                ? { tone: 'danger' as const }
                : {}),
            }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('reagentsSearch')}
            aria-label={tc('search')}
            className="w-full max-w-sm"
          />
          <Select
            size="sm"
            className="w-48"
            aria-label={tc('department')}
            value={department}
            onValueChange={setDepartment}
            options={[
              { value: 'all' as const, label: tc('allDepartments') },
              ...DEPARTMENTS.map((d) => ({
                value: d,
                label: e('department', d),
              })),
            ]}
          />
        </div>
      </Card>

      {lots.isPending || reagents.isPending ? (
        <div className="grid gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FlaskConicalIcon />}
            tone="violet"
            title={t('noLotsTitle')}
            description={t('emptyItemsBody')}
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {groups.map(({ reagent, lots: list }) => (
            <Card key={reagent.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-surface-2/40 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setParam('reagent', reagent.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-semibold text-fg hover:text-accent-text">
                    {reagent.name}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {t('reagentGroupMeta', {
                      manufacturer: reagent.manufacturer,
                      sku: reagent.sku ?? reagent.id,
                    })}{' '}
                    · {e('department', reagent.department)} ·{' '}
                    <StorageLabel
                      storage={reagent.storage}
                      className="inline-flex"
                    />
                  </p>
                </button>
                <div className="w-48">
                  <p className="text-meta text-fg-muted">
                    <span className="font-semibold text-fg tabular-nums">
                      {f.decimal(roundQty(reagent.totalUsable))}
                    </span>{' '}
                    {reagent.unit}
                    <span className="ml-1 text-2xs text-fg-subtle">
                      / {f.number(reagent.reorderLevel)}
                    </span>
                  </p>
                  <LevelBar
                    quantity={reagent.totalUsable}
                    reorderLevel={reagent.reorderLevel}
                    className="mt-1"
                  />
                </div>
                <StockBadge status={reagent.status} size="sm" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReceiving(reagent.id)}
                >
                  <PackageIcon />
                  {t('receiveShort')}
                </Button>
              </div>
              <div
                ref={focusWhenScrollable}
                className="focus-ring relative scrollbar-thin overflow-x-auto"
              >
                <table className="w-full min-w-[860px] table-fixed text-meta">
                  <thead>
                    <tr className="text-left text-xs text-fg-muted">
                      <th className="w-[13%] py-2 pr-3 pl-5 font-medium">
                        {t('colLot')}
                      </th>
                      <th className="w-[9%] px-3 py-2 font-medium">
                        {t('colReceived')}
                      </th>
                      <th className="w-[9%] px-3 py-2 font-medium">
                        {t('colOpened')}
                      </th>
                      <th className="w-[14%] px-3 py-2 font-medium">
                        {t('expiryDate')}
                      </th>
                      <th className="w-[11%] px-3 py-2 text-right font-medium">
                        {t('colQuantity')}
                      </th>
                      <th className="w-[19%] px-3 py-2 font-medium">
                        {t('colLocation')}
                      </th>
                      <th className="w-[11%] px-3 py-2 font-medium">
                        {t('colQc')}
                      </th>
                      <th className="w-[10%] px-3 py-2 font-medium">
                        {t('colStatus')}
                      </th>
                      <th className="w-[4.5rem] py-2 pr-5 pl-3">
                        <span className="sr-only">{tc('actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((l) => (
                      <tr
                        key={l.id}
                        className={cn(
                          'border-t border-line/70',
                          l.id === focusLot && 'bg-accent-soft/40',
                        )}
                      >
                        <td className="py-2.5 pr-3 pl-5 font-mono font-semibold whitespace-nowrap text-fg">
                          {l.lotNumber}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                          {f.dateShort(l.receivedAt)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                          {l.openedAt ? f.dateShort(l.openedAt) : '-'}
                        </td>
                        <td className="px-3 py-2.5">
                          <ExpiryText
                            expiresAt={l.expiresAt}
                            now={now}
                            className="text-meta"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                          <span className="font-semibold text-fg">
                            {f.decimal(roundQty(l.quantity))}
                          </span>{' '}
                          <span className="text-xs text-fg-muted">
                            / {f.number(l.initialQuantity)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-fg-muted">
                          {l.locationName ?? '-'}
                        </td>
                        <td className="px-3 py-2.5">
                          <QcLotBadge status={l.qcStatus} size="sm" />
                        </td>
                        <td className="px-3 py-2.5">
                          {l.state === 'active' ? (
                            <StockBadge status={l.status} size="sm" />
                          ) : (
                            <span className="text-xs font-medium text-fg-muted">
                              {e('lotState', l.state)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-5 pl-3 text-right">
                          <LotMenu lot={l} onAction={setAction} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {openReagent ? (
        <InventoryItemDrawer
          kind="reagent"
          id={openReagent}
          onClose={() => setParam('reagent', null)}
        />
      ) : null}
      {receiving !== null ? (
        <ReceiveLotDialog
          {...(receiving ? { defaultReagentId: receiving } : {})}
          onClose={closeReceiving}
        />
      ) : null}
      <LotActionDialogs action={action} onClose={() => setAction(null)} />
    </>
  )
}
