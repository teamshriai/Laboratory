import {
  ArrowLeftRightIcon,
  EllipsisIcon,
  EyeIcon,
  PackageIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useDeferredValue, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CONSUMABLE_CATEGORIES, type ConsumableCategory } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { ConsumableRow } from '@/services/lab-api'
import { useConsumables } from '@/services/queries'
import { StockBadge } from '@/components/lab/status'
import { Button } from '@/components/ui/button'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { SearchInput } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { AdjustStockDialog } from './adjust-dialog'
import { InventoryItemDrawer } from './item-drawer'
import { ReceiveConsumableDialog } from './receive-consumable-dialog'
import { coverUrgency } from './stock'
import { ExpiryText, LevelBar } from './stock-widgets'
import { TransferDialog } from './transfer-dialog'
import { focusWhenScrollable } from '@/lib/scroll-focus'

type Dialog =
  | { kind: 'receive' | 'adjust' | 'transfer'; item: ConsumableRow }
  | { kind: 'receive-any' }
  | null

export function Component() {
  const t = useT('inventory')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const [category, setCategory] = useState<ConsumableCategory | 'all'>('all')
  const [dialog, setDialog] = useState<Dialog>(null)
  const { data, isPending, isError, refetch, dataUpdatedAt } = useConsumables({
    q,
  })
  const openItem = params.get('item')
  const setItem = (id: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id) next.set('item', id)
      else next.delete('item')
      return next
    })

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  const rows = data ?? []
  const present = CONSUMABLE_CATEGORIES.filter((c) =>
    rows.some((r) => r.category === c),
  )
  const groups = present
    .filter((c) => category === 'all' || c === category)
    .map((c) => ({
      category: c,
      items: rows
        .filter((r) => r.category === c)
        .toSorted((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)),
    }))

  return (
    <>
      <PageHeader
        title={t('consumablesTitle')}
        meta={
          <>
            {dataUpdatedAt ? (
              <span className="text-xs text-fg-muted">
                {t('updated', { time: f.time(dataUpdatedAt) })}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <GuardedButton
              permission="inventory.manage"
              variant="primary"
              onClick={() => setDialog({ kind: 'receive-any' })}
            >
              <PackageIcon />
              {t('receive')}
            </GuardedButton>
          </>
        }
      />
      <Card className="mb-4 overflow-hidden">
        <div className="border-b border-line px-3 pt-2">
          <FilterTabs
            value={category}
            onValueChange={setCategory}
            className="md:flex-wrap md:overflow-visible"
            aria-label={t('colCategory')}
            items={[
              { value: 'all' as const, label: tc('all'), count: rows.length },
              ...present.map((c) => ({
                value: c,
                label: e('consumableCategory', c),
                count: rows.filter((r) => r.category === c).length,
              })),
            ]}
          />
        </div>
        <div className="px-4 py-3">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('consumablesSearch')}
            aria-label={tc('search')}
            className="w-full max-w-sm"
          />
        </div>
      </Card>

      {isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PackageIcon />}
            tone="orange"
            title={t('emptyItems')}
            description={t('emptyItemsBody')}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div
            ref={focusWhenScrollable}
            className="focus-ring relative scrollbar-thin overflow-x-auto"
          >
            <table className="w-full min-w-[900px] text-meta">
              <thead>
                <tr className="bg-surface-2 text-left text-xs text-fg-muted">
                  <th className="py-2.5 pr-3 pl-5 font-medium">
                    {t('colItem')}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t('colQuantity')}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t('colDaysLeft')}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t('colLocation')}
                  </th>
                  <th className="px-3 py-2.5 font-medium">{t('colExpiry')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('colStatus')}</th>
                  <th className="py-2.5 pr-5 pl-3">
                    <span className="sr-only">{tc('actions')}</span>
                  </th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.category}>
                  <tr>
                    <th
                      colSpan={7}
                      scope="rowgroup"
                      className="border-t border-line bg-surface-2/40 py-2 pl-5 text-left text-2xs font-semibold tracking-wide text-fg-subtle uppercase"
                    >
                      {e('consumableCategory', g.category)}
                    </th>
                  </tr>
                  {g.items.map((c) => {
                    const urgency = coverUrgency(c.daysLeft)
                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          'cursor-pointer border-t border-line/70 hover:bg-surface-2/60',
                          c.id === openItem && 'bg-accent-soft/40',
                        )}
                        onClick={() => setItem(c.id)}
                      >
                        <td className="py-2.5 pr-3 pl-5">
                          <p className="font-medium text-fg">{c.name}</p>
                          <p className="font-mono text-2xs text-fg-subtle">
                            {c.sku}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="w-36">
                            <p className="whitespace-nowrap">
                              <span className="font-semibold text-fg tabular-nums">
                                {f.number(c.quantity)}
                              </span>{' '}
                              <span className="text-xs text-fg-muted">
                                {c.unit}
                              </span>
                              <span className="ml-1 text-2xs text-fg-subtle">
                                / {f.number(c.reorderLevel)}
                              </span>
                            </p>
                            <LevelBar
                              quantity={c.quantity}
                              reorderLevel={c.reorderLevel}
                              className="mt-1"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={cn(
                              'font-semibold tabular-nums',
                              urgency === 'danger'
                                ? 'text-danger-text'
                                : urgency === 'warning'
                                  ? 'text-warning-text'
                                  : 'text-fg',
                            )}
                          >
                            {c.daysLeft === null
                              ? t('noCover')
                              : t('daysCover', {
                                  days: Math.floor(c.daysLeft),
                                })}
                          </span>
                          <span className="block text-2xs text-fg-subtle">
                            {t('perDay', {
                              value: `${f.number(c.dailyUsage)} ${c.unit}`,
                            })}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-fg-muted">
                          {c.location}
                        </td>
                        <td className="px-3 py-2.5">
                          {c.expiresAt ? (
                            <ExpiryText
                              expiresAt={c.expiresAt}
                              now={now}
                              className="text-meta"
                            />
                          ) : (
                            <span className="text-xs text-fg-subtle">
                              {t('noExpiry')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <StockBadge status={c.status} size="sm" />
                        </td>
                        <td
                          className="py-2.5 pr-5 pl-3 text-right"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <Menu>
                            <MenuTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={tc('moreActions')}
                              >
                                <EllipsisIcon strokeWidth={2.5} />
                              </Button>
                            </MenuTrigger>
                            <MenuContent align="end">
                              <MenuItem
                                icon={<EyeIcon />}
                                onSelect={() => setItem(c.id)}
                              >
                                {t('viewItem')}
                              </MenuItem>
                              <MenuItem
                                icon={<PackageIcon />}
                                onSelect={() =>
                                  setDialog({ kind: 'receive', item: c })
                                }
                              >
                                {t('receiveShort')}
                              </MenuItem>
                              <MenuItem
                                icon={<SlidersHorizontalIcon />}
                                onSelect={() =>
                                  setDialog({ kind: 'adjust', item: c })
                                }
                              >
                                {t('adjust')}
                              </MenuItem>
                              <MenuItem
                                icon={<ArrowLeftRightIcon />}
                                onSelect={() =>
                                  setDialog({ kind: 'transfer', item: c })
                                }
                              >
                                {t('transfer')}
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </Card>
      )}

      {openItem ? (
        <InventoryItemDrawer
          kind="consumable"
          id={openItem}
          onClose={() => setItem(null)}
        />
      ) : null}
      {dialog?.kind === 'receive-any' ? (
        <ReceiveConsumableDialog onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'receive' ? (
        <ReceiveConsumableDialog
          defaultId={dialog.item.id}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'adjust' ? (
        <AdjustStockDialog
          target={{
            kind: 'consumable',
            id: dialog.item.id,
            name: dialog.item.name,
            quantity: dialog.item.quantity,
            unit: dialog.item.unit,
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'transfer' ? (
        <TransferDialog
          target={{
            kind: 'consumable',
            id: dialog.item.id,
            name: dialog.item.name,
            quantity: dialog.item.quantity,
            unit: dialog.item.unit,
            ...(dialog.item.locationId
              ? { locationId: dialog.item.locationId }
              : {}),
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  )
}
