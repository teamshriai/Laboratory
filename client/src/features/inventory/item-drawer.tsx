import {
  ArrowLeftRightIcon,
  EllipsisIcon,
  LockIcon,
  LockOpenIcon,
  PackageIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  CircleXIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { labApi, type InventoryKind, type LotRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useInventoryItem } from '@/services/queries'
import { StockBadge } from '@/components/lab/status'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { AdjustStockDialog } from './adjust-dialog'
import { LotActionDialogs } from './lot-dialogs'
import { ReceiveConsumableDialog } from './receive-consumable-dialog'
import { ReceiveLotDialog } from './receive-lot-dialog'
import { lotActions, roundQty, type LotAction } from './stock'
import {
  DrawerSection,
  ExpiryText,
  ItemIcon,
  LevelBar,
  QcLotBadge,
  StockTimeline,
  StorageLabel,
} from './stock-widgets'
import { TransferDialog } from './transfer-dialog'

export function LotMenu({
  lot,
  onAction,
}: {
  lot: LotRow
  onAction: (a: LotAction) => void
}) {
  const t = useT('inventory')
  const tc = useT('common')
  const now = useNow()
  const allowed = lotActions(lot, now)
  const open = useLabMutation(() => labApi.inventory.openLot(lot.id), {
    success: () => t('openedToast', { lot: lot.lotNumber }),
  })
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={tc('moreActions')}
          onClick={(ev) => ev.stopPropagation()}
        >
          <EllipsisIcon strokeWidth={2.5} />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {allowed.open ? (
          <MenuItem icon={<PackageIcon />} onSelect={() => open.mutate()}>
            {t('markOpened')}
          </MenuItem>
        ) : null}
        {allowed.transfer ? (
          <MenuItem
            icon={<ArrowLeftRightIcon />}
            onSelect={() => onAction({ kind: 'transfer', lot })}
          >
            {t('transfer')}
          </MenuItem>
        ) : null}
        {allowed.adjust ? (
          <MenuItem
            icon={<SlidersHorizontalIcon />}
            onSelect={() => onAction({ kind: 'adjust', lot })}
          >
            {t('adjust')}
          </MenuItem>
        ) : null}
        {allowed.quarantine ? (
          <MenuItem
            icon={<LockIcon />}
            onSelect={() => onAction({ kind: 'quarantine', lot })}
          >
            {t('quarantine')}
          </MenuItem>
        ) : null}
        {allowed.release ? (
          <MenuItem
            icon={<LockOpenIcon />}
            onSelect={() => onAction({ kind: 'release', lot })}
          >
            {t('release')}
          </MenuItem>
        ) : null}
        {allowed.expire ? (
          <MenuItem
            icon={<CircleXIcon />}
            onSelect={() => onAction({ kind: 'expire', lot })}
            danger
          >
            {t('markExpired')}
          </MenuItem>
        ) : null}
        {allowed.dispose ? (
          <MenuItem
            icon={<Trash2Icon />}
            onSelect={() => onAction({ kind: 'dispose', lot })}
            danger
          >
            {t('dispose')}
          </MenuItem>
        ) : null}
      </MenuContent>
    </Menu>
  )
}

export function InventoryItemDrawer({
  kind,
  id,
  onClose,
}: {
  kind: InventoryKind
  id: string
  onClose: () => void
}) {
  const t = useT('inventory')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const { data, isPending, isError, refetch } = useInventoryItem(kind, id)
  const [action, setAction] = useState<LotAction | null>(null)
  const [dialog, setDialog] = useState<
    'receive' | 'adjust' | 'transfer' | null
  >(null)

  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={data?.name ?? t('viewItem')}
      description={
        data
          ? `${data.sku} · ${data.kind === 'reagent' ? (data.manufacturer ?? '') : e('consumableCategory', data.category as 'tubes')}`
          : undefined
      }
      headerExtra={data ? <StockBadge status={data.status} size="sm" /> : null}
      footer={
        data ? (
          <div className="flex w-full flex-wrap justify-end gap-2">
            {kind === 'consumable' ? (
              <>
                <Button variant="ghost" onClick={() => setDialog('transfer')}>
                  <ArrowLeftRightIcon />
                  {t('transfer')}
                </Button>
                <Button variant="secondary" onClick={() => setDialog('adjust')}>
                  <SlidersHorizontalIcon />
                  {t('adjust')}
                </Button>
              </>
            ) : null}
            <Button variant="primary" onClick={() => setDialog('receive')}>
              <PackageIcon />
              {t('receive')}
            </Button>
          </div>
        ) : null
      }
    >
      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isPending || !data ? (
        <div className="grid gap-4 p-5">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-6 p-5">
          <DrawerSection title={t('sectionStock')}>
            <div className="flex items-center gap-4 rounded-xl border border-line p-4">
              <ItemIcon kind={data.kind} />
              <div className="min-w-0 flex-1">
                <p className="text-2xl leading-none font-semibold text-fg tabular-nums">
                  {f.decimal(roundQty(data.quantity))}{' '}
                  <span className="text-sm font-normal text-fg-muted">
                    {data.unit}
                  </span>
                </p>
                <LevelBar
                  quantity={data.quantity}
                  reorderLevel={data.minLevel}
                  className="mt-3"
                />
                <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-fg-muted">
                  <span>
                    {t('reorderLevel', {
                      value: `${f.number(data.minLevel)} ${data.unit}`,
                    })}
                  </span>
                  {data.dailyUsage ? (
                    <span>
                      {t('perDay', {
                        value: `${f.number(data.dailyUsage)} ${data.unit}`,
                      })}
                    </span>
                  ) : null}
                  {data.storage ? (
                    <StorageLabel storage={data.storage} />
                  ) : null}
                </p>
              </div>
            </div>
          </DrawerSection>

          {data.kind === 'reagent' ? (
            <DrawerSection title={t('sectionLots')}>
              {data.lotRows.length === 0 ? (
                <p className="text-meta text-fg-muted">{t('noLots')}</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {data.lotRows.map((lot) => (
                    <li
                      key={lot.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3',
                        (lot.state === 'depleted' ||
                          lot.state === 'disposed') &&
                          'opacity-60',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-meta font-semibold text-fg">
                            {lot.lotNumber}
                          </span>
                          <QcLotBadge status={lot.qcStatus} size="sm" />
                          {lot.state !== 'active' ? (
                            <span className="text-2xs font-medium text-fg-muted">
                              {e('lotState', lot.state)}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-fg-muted">
                          {lot.locationName ?? t('unknownLocation')} ·{' '}
                          {t('colReceived')} {f.dateShort(lot.receivedAt)}
                          {lot.openedAt
                            ? ` · ${t('colOpened')} ${f.dateShort(lot.openedAt)}`
                            : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-meta font-semibold text-fg tabular-nums">
                          {f.decimal(roundQty(lot.quantity))}{' '}
                          <span className="text-xs font-normal text-fg-muted">
                            {lot.reagent.unit}
                          </span>
                        </p>
                        <ExpiryText
                          expiresAt={lot.expiresAt}
                          now={now}
                          className="text-xs"
                        />
                      </div>
                      <LotMenu lot={lot} onAction={setAction} />
                    </li>
                  ))}
                </ul>
              )}
            </DrawerSection>
          ) : null}

          <DrawerSection title={t('sectionSupplier')}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-meta">
              <div>
                <dt className="text-xs text-fg-muted">{t('supplier')}</dt>
                <dd className="text-fg">{data.supplier?.name ?? '-'}</dd>
                {data.supplier ? (
                  <dd className="text-xs text-fg-muted">
                    {data.supplier.city} · {data.supplier.phone} ·{' '}
                    {t('leadDays', { days: data.supplier.leadDays })}
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-xs text-fg-muted">{t('location')}</dt>
                <dd className="text-fg">
                  {data.locations.join(', ') || t('unknownLocation')}
                </dd>
              </div>
            </dl>
          </DrawerSection>

          <DrawerSection title={t('sectionHistory')}>
            <div className="mb-3 flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-meta">
              <span className="text-fg-muted">
                {t('openingBalance')}{' '}
                <span className="font-semibold text-fg tabular-nums">
                  {f.decimal(data.openingBalance)} {data.unit}
                </span>
              </span>
              <span className="text-fg-muted">
                {t('currentBalance')}{' '}
                <span className="font-semibold text-fg tabular-nums">
                  {f.decimal(roundQty(data.quantity))} {data.unit}
                </span>
              </span>
            </div>
            <StockTimeline
              transactions={data.movements}
              unit={data.unit}
              pageSize={15}
            />
          </DrawerSection>
        </div>
      )}
      <LotActionDialogs action={action} onClose={() => setAction(null)} />
      {data && dialog === 'receive' ? (
        kind === 'reagent' ? (
          <ReceiveLotDialog
            defaultReagentId={id}
            onClose={() => setDialog(null)}
          />
        ) : (
          <ReceiveConsumableDialog
            defaultId={id}
            onClose={() => setDialog(null)}
          />
        )
      ) : null}
      {data && dialog === 'adjust' ? (
        <AdjustStockDialog
          target={{
            kind: 'consumable',
            id,
            name: data.name,
            quantity: data.quantity,
            unit: data.unit,
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {data && dialog === 'transfer' ? (
        <TransferDialog
          target={{
            kind: 'consumable',
            id,
            name: data.name,
            quantity: data.quantity,
            unit: data.unit,
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </Drawer>
  )
}
