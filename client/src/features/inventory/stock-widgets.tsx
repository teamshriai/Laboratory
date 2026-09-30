import {
  RotateCcwIcon,
  ArrowLeftRightIcon,
  Trash2Icon,
  FlaskConicalIcon,
  HourglassIcon,
  LockIcon,
  LockOpenIcon,
  MoonIcon,
  PackageIcon,
  BadgeCheckIcon,
  BadgeAlertIcon,
  SlidersHorizontalIcon,
  SnowflakeIcon,
  ThermometerSnowflakeIcon,
  ThermometerIcon,
  CircleAlertIcon,
  CircleXIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DAY } from '@/domain/time'
import type {
  QcLotStatus,
  StockTransaction,
  StockTxnType,
  StorageCondition,
} from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Meter, Timeline, type TimelineEntry } from '@/components/ui/misc'
import {
  daysUntil,
  expiryUrgency,
  roundQty,
  useSignedQty,
  useStaffName,
  type Urgency,
} from './stock'
import { IconTile } from '@/components/ui/icon-tile'

const URGENCY_TEXT: Record<Urgency, string> = {
  danger: 'text-danger-text',
  warning: 'text-warning-text',
  neutral: 'text-fg-muted',
}

/** Expiry date with a relative hint ("in 12 days", "Expired") coloured by urgency. */
export function ExpiryText({
  expiresAt,
  now,
  className,
}: {
  expiresAt: number | undefined
  now: number
  className?: string
}) {
  const t = useT('inventory')
  const f = useFormat()
  if (expiresAt === undefined)
    return (
      <span className={cn('text-meta text-fg-subtle', className)}>
        {t('noExpiry')}
      </span>
    )
  const expired = expiresAt <= now
  const days = daysUntil(expiresAt, now)
  const urgency = expiryUrgency(expiresAt, now)
  const relative = expired
    ? now - expiresAt < DAY
      ? t('expiredToday')
      : t('expiredDaysAgo', { count: Math.floor((now - expiresAt) / DAY) })
    : days === 0
      ? t('expiresToday')
      : t('expiresInDays', { count: days })
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-meta whitespace-nowrap text-fg">{f.date(expiresAt)}</p>
      <p
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap',
          URGENCY_TEXT[urgency],
        )}
      >
        {urgency === 'danger' ? (
          <CircleAlertIcon className="size-3.5" />
        ) : urgency === 'warning' ? (
          <HourglassIcon className="size-3.5" />
        ) : null}
        {relative}
      </p>
    </div>
  )
}

/** Quantity with a small meter against a reference amount (initial quantity). */
export function QuantityMeter({
  quantity,
  max,
  unit,
  caption,
  tone = 'accent',
  className,
}: {
  quantity: number
  max: number
  unit: string
  caption?: ReactNode
  tone?: 'accent' | 'warning' | 'danger' | 'success'
  className?: string
}) {
  const f = useFormat()
  return (
    <div className={cn('w-32', className)}>
      <p className="text-meta whitespace-nowrap">
        <span className="font-semibold text-fg tabular-nums">
          {f.decimal(roundQty(quantity))}
        </span>{' '}
        <span className="text-xs text-fg-muted">{unit}</span>
      </p>
      <Meter value={quantity} max={max} tone={tone} className="mt-1.5" />
      {caption ? (
        <p className="mt-1 text-2xs whitespace-nowrap text-fg-subtle tabular-nums">
          {caption}
        </p>
      ) : null}
    </div>
  )
}

/** Stock level bar with a tick at the reorder level. */
export function LevelBar({
  quantity,
  reorderLevel,
  className,
}: {
  quantity: number
  reorderLevel: number
  className?: string
}) {
  const scale = Math.max(quantity, reorderLevel * 2, 1)
  const fill = Math.min(100, (Math.max(0, quantity) / scale) * 100)
  const mark = Math.min(100, (reorderLevel / scale) * 100)
  const tone =
    quantity <= 0
      ? 'bg-danger'
      : quantity <= reorderLevel
        ? 'bg-warning'
        : 'bg-accent'
  return (
    <span
      className={cn(
        'relative block h-1.5 rounded-full bg-surface-3',
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          'block h-full rounded-full transition-[width] duration-500',
          tone,
        )}
        style={{ width: `${fill}%` }}
      />
      <span
        className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-full bg-fg-subtle"
        style={{ left: `calc(${mark}% - 1px)` }}
      />
    </span>
  )
}

const QC_LOT: Record<QcLotStatus, { tone: BadgeTone; icon: ReactNode }> = {
  passed: { tone: 'success', icon: <BadgeCheckIcon /> },
  pending: { tone: 'outline', icon: <HourglassIcon /> },
  failed: { tone: 'danger', icon: <BadgeAlertIcon /> },
}

export function QcLotBadge({
  status,
  size,
}: {
  status: QcLotStatus
  size?: 'sm' | 'md'
}) {
  const e = useEnum()
  const spec = QC_LOT[status]
  return (
    <Badge tone={spec.tone} size={size}>
      {spec.icon}
      {e('qcLotStatus', status)}
    </Badge>
  )
}

const STORAGE_ICONS: Record<StorageCondition, ReactNode> = {
  refrigerated: <ThermometerSnowflakeIcon />,
  frozen: <SnowflakeIcon />,
  'room-temperature': <ThermometerIcon />,
  'dark-refrigerated': <MoonIcon />,
}

export function StorageLabel({
  storage,
  className,
}: {
  storage: StorageCondition
  className?: string
}) {
  const e = useEnum()
  return (
    <span
      className={cn(
        'inline-flex items-start gap-1.5 text-meta text-fg [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-subtle',
        className,
      )}
    >
      {STORAGE_ICONS[storage]}
      <span>{e('storage', storage)}</span>
    </span>
  )
}

/** Tinted square that marks an item as a reagent or a consumable. */
export function ItemIcon({
  kind,
  className,
}: {
  kind: 'reagent' | 'consumable'
  className?: string
}) {
  return (
    <IconTile
      icon={kind === 'reagent' ? <FlaskConicalIcon /> : <PackageIcon />}
      tone={kind === 'reagent' ? 'violet' : 'orange'}
      size="sm"
      className={className}
    />
  )
}

export function DrawerSection({
  title,
  children,
  action,
}: {
  title: ReactNode
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

const TXN: Record<
  StockTxnType,
  { icon: ReactNode; tone: TimelineEntry['tone'] }
> = {
  receive: { icon: <PackageIcon />, tone: 'success' },
  consume: { icon: <FlaskConicalIcon />, tone: 'neutral' },
  adjust: { icon: <SlidersHorizontalIcon />, tone: 'accent' },
  quarantine: { icon: <LockIcon />, tone: 'warning' },
  release: { icon: <LockOpenIcon />, tone: 'success' },
  expire: { icon: <CircleXIcon />, tone: 'danger' },
  transfer: { icon: <ArrowLeftRightIcon />, tone: 'accent' },
  dispose: { icon: <Trash2Icon />, tone: 'danger' },
  open: { icon: <PackageIcon />, tone: 'neutral' },
}

/** Stock movements, newest first, with a "show more" control for long histories. */
type TimelineTxn = StockTransaction & {
  lotNumber?: string
  fromName?: string
  toName?: string
  itemName?: string
  unit?: string
}

export function StockTimeline({
  transactions,
  unit,
  pageSize = 25,
  showItem,
}: {
  transactions: TimelineTxn[]
  unit: string
  pageSize?: number
  showItem?: boolean
}) {
  const t = useT('inventory')
  const e = useEnum()
  const f = useFormat()
  const staffName = useStaffName()
  const signed = useSignedQty()
  const [limit, setLimit] = useState(pageSize)
  if (transactions.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-meta text-fg-muted">
        {t('noHistory')}
      </p>
    )
  const items: TimelineEntry[] = transactions.slice(0, limit).map((tx) => ({
    id: tx.id,
    icon: TXN[tx.type].icon,
    tone: TXN[tx.type].tone,
    title: (
      <>
        {showItem && tx.itemName ? (
          <span className="block text-meta font-medium">{tx.itemName}</span>
        ) : null}
        <span className="font-medium">{e('txnType', tx.type)}</span>
        {tx.lotNumber ? (
          <span className="ml-1.5 font-mono text-xs text-fg-muted">
            {tx.lotNumber}
          </span>
        ) : null}
        {tx.quantity !== 0 ? (
          <span
            className={cn(
              'ml-2 font-semibold tabular-nums',
              tx.quantity > 0 ? 'text-success-text' : 'text-fg',
            )}
          >
            {signed(tx.quantity, tx.unit ?? unit)}
          </span>
        ) : null}
        {tx.type === 'transfer' && tx.toName ? (
          <span className="block text-meta text-fg-muted">
            {t('transferFromTo', {
              from: tx.fromName ?? t('unknownLocation'),
              to: tx.toName,
            })}
          </span>
        ) : null}
        {tx.reason ? (
          <span className="text-fg-muted">
            {' '}
            · {e('adjustReason', tx.reason)}
          </span>
        ) : null}
        {tx.note ? (
          <span className="mt-0.5 block text-meta text-fg-muted">
            {tx.note}
          </span>
        ) : null}
      </>
    ),
    meta: t('txnMeta', {
      balance: `${f.decimal(roundQty(tx.balance))} ${tx.unit ?? unit}`,
      by: staffName(tx.by),
      time: f.dateTime(tx.at),
    }),
  }))
  const remaining = transactions.length - limit
  return (
    <div>
      <Timeline items={items} />
      {remaining > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setLimit((l) => l + pageSize)}
        >
          <RotateCcwIcon />
          {t('showOlder', { count: Math.min(remaining, pageSize) })}
        </Button>
      ) : null}
    </div>
  )
}
