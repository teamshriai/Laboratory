import {
  ArrowLeftRightIcon,
  ChevronDownIcon,
  ClockAlertIcon,
  FlaskConicalIcon,
  LockIcon,
  PackageIcon,
  LayersIcon,
  Trash2Icon,
} from 'lucide-react'
import { MetricStrip } from '@/components/ui/metric-strip'
import { PageHeader } from '@/app/layout/page-header'
import { useDeferredValue, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  CONSUMABLE_CATEGORIES,
  STOCK_STATUSES,
  type StockStatus,
} from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type {} from '@/lib/icon-tones'
import type {
  ExpiryRow,
  ExpiryWindow,
  InventoryCategory,
  InventoryItemRow,
  InventoryKind,
  LotRow,
} from '@/services/lab-api'
import {
  useExpiry,
  useInventoryItems,
  useInventoryMeta,
  useLots,
  useMovements,
} from '@/services/queries'
import { StockBadge } from '@/components/lab/status'
import { Button } from '@/components/ui/button'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import { InventoryItemDrawer } from './item-drawer'
import { LotActionDialogs } from './lot-dialogs'
import { ReceiveConsumableDialog } from './receive-consumable-dialog'
import { ReceiveLotDialog } from './receive-lot-dialog'
import { roundQty, type LotAction } from './stock'
import { ExpiryText, ItemIcon, LevelBar, StockTimeline } from './stock-widgets'

const WINDOWS: ExpiryWindow[] = ['expired', '7d', '30d', '90d']
const TABS = ['items', 'expiry', 'movements'] as const
type Tab = (typeof TABS)[number]

const ITEM_KINDS: readonly InventoryKind[] = ['reagent', 'consumable']

export function Component() {
  const t = useT('inventory')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab)
    ? (params.get('tab') as Tab)
    : 'items'
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const [category, setCategory] = useState<InventoryCategory | 'all'>('all')
  const [status, setStatus] = useState<StockStatus | 'all'>('all')
  const [expiry, setExpiry] = useState<ExpiryWindow | 'all'>('all')
  const [locationId, setLocationId] = useState('all')
  const [supplierId, setSupplierId] = useState('all')
  const [receive, setReceive] = useState<InventoryKind | null>(null)
  const [action, setAction] = useState<LotAction | null>(null)

  const all = useInventoryItems({})
  const items = useInventoryItems({
    q,
    ...(category !== 'all' ? { category } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(expiry !== 'all' ? { expiry } : {}),
    ...(locationId !== 'all' ? { locationId } : {}),
    ...(supplierId !== 'all' ? { supplierId } : {}),
  })
  const { data: meta } = useInventoryMeta()
  const expiryRows = useExpiry()
  const movements = useMovements(120)
  const { data: lots } = useLots({})

  const [itemParam, openItem, closeItem] = useOverlayParam('item')
  // ?item=kind:id; an unknown kind (hand-edited link) is ignored.
  const sep = itemParam?.indexOf(':') ?? -1
  const rawKind = itemParam && sep > 0 ? itemParam.slice(0, sep) : undefined
  const openKind = ITEM_KINDS.find((k) => k === rawKind)
  const openId = itemParam && sep > 0 ? itemParam.slice(sep + 1) : undefined
  const setParam = (key: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === null) next.delete(key)
      else next.set(key, value)
      return next
    })

  const rows = all.data ?? []
  const count = (pred: (r: InventoryItemRow) => boolean) =>
    rows.filter(pred).length
  const received7d = (movements.data ?? []).filter(
    (m) => m.type === 'receive' && m.at >= now - 7 * 86_400_000,
  ).length

  const columns: Column<InventoryItemRow>[] = [
    {
      id: 'item',
      header: t('colItem'),
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <ItemIcon kind={r.kind} />
          <div className="min-w-0">
            <p className="truncate text-meta font-medium text-fg">{r.name}</p>
            <p className="text-xs text-fg-muted">
              {e(
                r.kind === 'reagent'
                  ? 'inventoryCategory'
                  : 'consumableCategory',
                r.category as 'reagent',
              )}
              {r.department ? ` · ${e('department', r.department)}` : ''}
              {r.lots ? ` · ${t('lotsCount', { count: r.lots })}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'sku',
      header: t('colSku'),
      sortValue: (r) => r.sku,
      cell: (r) => (
        <span className="font-mono text-xs whitespace-nowrap text-fg-muted">
          {r.sku}
        </span>
      ),
    },
    {
      id: 'qty',
      header: t('colQuantity'),
      sortValue: (r) => r.quantity / Math.max(1, r.minLevel),
      cell: (r) => (
        <div className="w-36">
          <p className="text-meta whitespace-nowrap">
            <span className="font-semibold text-fg tabular-nums">
              {f.decimal(roundQty(r.quantity))}
            </span>{' '}
            <span className="text-xs text-fg-muted">{r.unit}</span>
            <span className="ml-1.5 text-2xs text-fg-subtle">
              / {f.number(r.minLevel)}
            </span>
          </p>
          <LevelBar
            quantity={r.quantity}
            reorderLevel={r.minLevel}
            className="mt-1"
          />
        </div>
      ),
    },
    {
      id: 'location',
      tabletHidden: true,
      header: t('colLocation'),
      cell: (r) => (
        <span className="text-meta text-fg">
          {r.locations[0] ?? '-'}
          {r.locations.length > 1 ? (
            <span className="ml-1 text-xs text-fg-subtle">
              {t('moreLocations', { count: r.locations.length - 1 })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'expiry',
      header: t('colExpiry'),
      sortValue: (r) => r.nearestExpiry ?? Infinity,
      cell: (r) =>
        r.nearestExpiry ? (
          <ExpiryText
            expiresAt={r.nearestExpiry}
            now={now}
            className="text-meta"
          />
        ) : (
          <span className="text-xs text-fg-subtle">{t('noExpiry')}</span>
        ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      sortValue: (r) => STOCK_STATUSES.indexOf(r.status),
      cell: (r) => <StockBadge status={r.status} size="sm" />,
    },
  ]

  const lotById = new Map((lots ?? []).map((l) => [l.id, l]))
  const expiryAction = (row: ExpiryRow, kind: 'quarantine' | 'dispose') => {
    const lot: LotRow | undefined = lotById.get(row.id)
    if (lot) setAction({ kind, lot })
  }

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
            <Menu>
              <MenuTrigger asChild>
                <GuardedButton permission="inventory.manage" variant="primary">
                  <PackageIcon />
                  {t('receive')}
                  <ChevronDownIcon className="size-3.5" />
                </GuardedButton>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem
                  icon={<FlaskConicalIcon />}
                  onSelect={() => setReceive('reagent')}
                >
                  {e('inventoryCategory', 'reagent')}
                </MenuItem>
                <MenuItem
                  icon={<PackageIcon />}
                  onSelect={() => setReceive('consumable')}
                >
                  {t('consumablesTitle')}
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      <MetricStrip
        className="mb-5"
        items={[
          { key: 'items', label: t('totalItems'), value: rows.length },
          {
            key: 'low',
            label: t('lowStock'),
            value: count(
              (r) => r.status === 'low-stock' || r.status === 'out-of-stock',
            ),
            href: '/inventory?tab=items',
          },
          {
            key: 'expiring',
            label: t('expiringSoon'),
            value: (expiryRows.data ?? []).filter(
              (r) => r.window === '7d' || r.window === '30d',
            ).length,
            href: '/inventory?tab=expiry',
          },
          {
            key: 'expired',
            label: t('expired'),
            value: (expiryRows.data ?? []).filter((r) => r.window === 'expired')
              .length,
            alert: (expiryRows.data ?? []).some((r) => r.window === 'expired'),
            href: '/inventory?tab=expiry',
          },
          {
            key: 'quarantined',
            label: t('quarantined'),
            value: (lots ?? []).filter((l) => l.state === 'quarantined').length,
          },
          {
            key: 'received',
            label: t('receivedRecent'),
            value: received7d,
            href: '/inventory?tab=movements',
          },
        ]}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setParam('tab', v === 'items' ? null : v)}
      >
        <TabsList
          className="mb-4"
          items={[
            { value: 'items', label: t('tabItems'), count: rows.length },
            {
              value: 'expiry',
              label: t('tabExpiry'),
              count:
                expiryRows.data?.filter((r) => r.window !== '90d').length ?? 0,
            },
            { value: 'movements', label: t('tabMovements') },
          ]}
        />
        <TabsContent value="items">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <SearchInput
                value={query}
                onValueChange={setQuery}
                placeholder={t('search')}
                aria-label={tc('search')}
                className="w-full max-w-xs"
              />
              <Select
                size="sm"
                className="w-44"
                aria-label={t('colCategory')}
                value={category}
                onValueChange={setCategory}
                options={[
                  { value: 'all' as const, label: t('allCategories') },
                  {
                    value: 'reagent' as const,
                    label: e('inventoryCategory', 'reagent'),
                  },
                  ...CONSUMABLE_CATEGORIES.map((c) => ({
                    value: c,
                    label: e('consumableCategory', c),
                  })),
                ]}
              />
              <Select
                size="sm"
                className="w-40"
                aria-label={t('colStatus')}
                value={status}
                onValueChange={setStatus}
                options={[
                  { value: 'all' as const, label: t('allStatuses') },
                  ...STOCK_STATUSES.map((s) => ({
                    value: s,
                    label: e('stockStatus', s),
                  })),
                ]}
              />
              <Select
                size="sm"
                className="w-36"
                aria-label={t('colExpiry')}
                value={expiry}
                onValueChange={setExpiry}
                options={[
                  { value: 'all' as const, label: t('anyExpiry') },
                  ...WINDOWS.map((w) => ({
                    value: w,
                    label: e('expiryWindow', w),
                  })),
                ]}
              />
              <Select
                size="sm"
                className="w-48"
                aria-label={t('colLocation')}
                value={locationId}
                onValueChange={setLocationId}
                options={[
                  { value: 'all', label: t('allLocations') },
                  ...(meta?.locations ?? []).map((l) => ({
                    value: l.id,
                    label: l.name,
                  })),
                ]}
              />
              <Select
                size="sm"
                className="w-48"
                aria-label={t('supplier')}
                value={supplierId}
                onValueChange={setSupplierId}
                options={[
                  { value: 'all', label: t('allSuppliers') },
                  ...(meta?.suppliers ?? []).map((s) => ({
                    value: s.id,
                    label: s.name,
                  })),
                ]}
              />
            </div>
            <DataTable
              caption={t('tabItems')}
              columns={columns}
              rows={items.data}
              getRowId={(r) => `${r.kind}:${r.id}`}
              rowLabel={(r) => r.name}
              onRowClick={(r) => openItem(`${r.kind}:${r.id}`)}
              isLoading={items.isPending}
              isError={items.isError}
              onRetry={() => void items.refetch()}
              pageSize={20}
              minWidth={920}
              activeRowId={itemParam}
              empty={
                <EmptyState
                  icon={<LayersIcon />}
                  tone="amber"
                  title={t('emptyItems')}
                  description={t('emptyItemsBody')}
                />
              }
            />
          </Card>
        </TabsContent>

        <TabsContent value="expiry">
          {expiryRows.data && expiryRows.data.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ClockAlertIcon />}
                tone="green"
                title={t('noExpiryAlerts')}
                description={t('noExpiryAlertsBody')}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              {WINDOWS.map((w) => {
                const list = (expiryRows.data ?? []).filter(
                  (r) => r.window === w,
                )
                return (
                  <section
                    key={w}
                    className="border-t border-line first:border-t-0"
                  >
                    <h2
                      className={cn(
                        'flex items-baseline gap-2 bg-surface-2/60 px-5 py-2 text-meta font-semibold',
                        w === 'expired'
                          ? 'text-danger-text'
                          : w === '7d'
                            ? 'text-warning-text'
                            : 'text-fg',
                      )}
                    >
                      {t(`window.${w}`)}
                      <span className="font-normal text-fg-muted tabular-nums">
                        {list.length}
                      </span>
                    </h2>
                    {list.length === 0 ? (
                      <p className="px-5 py-3 text-meta text-fg-subtle">
                        {t('expiryEmpty')}
                      </p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {list.map((r) => (
                          <li
                            key={`${r.kind}:${r.id}`}
                            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5"
                          >
                            <button
                              type="button"
                              className="min-w-48 flex-1 text-left"
                              onClick={() => openItem(`${r.kind}:${r.itemId}`)}
                            >
                              <span className="block truncate text-meta font-medium text-fg hover:underline">
                                {r.name}
                              </span>
                              <span className="block text-xs text-fg-muted">
                                {r.lotNumber ? (
                                  <span className="font-mono">
                                    {r.lotNumber} ·{' '}
                                  </span>
                                ) : null}
                                {f.decimal(roundQty(r.quantity))} {r.unit}
                                {r.locationName ? ` · ${r.locationName}` : ''}
                              </span>
                            </button>
                            <ExpiryText
                              expiresAt={r.expiresAt}
                              now={now}
                              className="w-32 text-xs"
                            />
                            {r.kind === 'reagent' ? (
                              <span className="flex gap-1">
                                {r.state === 'active' &&
                                r.window !== 'expired' ? (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() =>
                                      expiryAction(r, 'quarantine')
                                    }
                                  >
                                    <LockIcon aria-hidden />
                                    {t('quarantine')}
                                  </Button>
                                ) : null}
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  className="text-danger-text"
                                  onClick={() => expiryAction(r, 'dispose')}
                                >
                                  <Trash2Icon aria-hidden />
                                  {t('dispose')}
                                </Button>
                              </span>
                            ) : (
                              <span className="w-24" aria-hidden />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )
              })}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="movements">
          <Card className="p-5">
            {movements.data && movements.data.length === 0 ? (
              <EmptyState
                icon={<ArrowLeftRightIcon />}
                compact
                title={t('movementsEmpty')}
              />
            ) : (
              <StockTimeline
                transactions={movements.data ?? []}
                unit=""
                pageSize={30}
                showItem
              />
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {openKind && openId ? (
        <InventoryItemDrawer kind={openKind} id={openId} onClose={closeItem} />
      ) : null}
      {receive === 'reagent' ? (
        <ReceiveLotDialog onClose={() => setReceive(null)} />
      ) : null}
      {receive === 'consumable' ? (
        <ReceiveConsumableDialog onClose={() => setReceive(null)} />
      ) : null}
      <LotActionDialogs action={action} onClose={() => setAction(null)} />
    </>
  )
}
