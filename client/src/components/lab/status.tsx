import {
  ChevronsUpIcon,
  CircleCheckIcon,
  ClockIcon,
  DropletIcon,
  FileTextIcon,
  FlaskConicalIcon,
  HourglassIcon,
  ZapIcon,
  LockIcon,
  PackageIcon,
  CirclePauseIcon,
  PencilIcon,
  BanIcon,
  BadgeCheckIcon,
  TruckIcon,
  CircleAlertIcon,
  TriangleAlertIcon,
  WrenchIcon,
  CircleXIcon,
  Undo2Icon,
  CircleDashedIcon,
  BellRingIcon,
  PhoneCallIcon,
  ScanSearchIcon,
  UnplugIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  CriticalState,
  CriticalStatus,
  EquipmentStatus,
  OrderStatus,
  Priority,
  QcResult,
  ReportStatus,
  ResultStatus,
  SampleStatus,
  StockStatus,
} from '@/domain/types'
import { useEnum } from '@/i18n/context'
import { Badge, type BadgeTone } from '../ui/badge'

type Spec = { tone: BadgeTone; icon: ReactNode }

const ORDER: Record<OrderStatus, Spec> = {
  draft: { tone: 'outline', icon: <PencilIcon /> },
  new: { tone: 'info', icon: <ClockIcon /> },
  'partially-collected': { tone: 'info', icon: <DropletIcon /> },
  collected: { tone: 'neutral', icon: <DropletIcon /> },
  processing: { tone: 'neutral', icon: <FlaskConicalIcon /> },
  'pending-result': { tone: 'warning', icon: <HourglassIcon /> },
  'awaiting-review': { tone: 'warning', icon: <ScanSearchIcon /> },
  'awaiting-validation': { tone: 'warning', icon: <BadgeCheckIcon /> },
  'awaiting-release': { tone: 'info', icon: <FileTextIcon /> },
  'partially-reported': { tone: 'info', icon: <FileTextIcon /> },
  completed: { tone: 'success', icon: <CircleCheckIcon /> },
  cancelled: { tone: 'outline', icon: <BanIcon /> },
  rejected: { tone: 'danger', icon: <CircleXIcon /> },
}

const SAMPLE: Record<SampleStatus, Spec> = {
  pending_collection: { tone: 'warning', icon: <ClockIcon /> },
  collected: { tone: 'neutral', icon: <TruckIcon /> },
  received: { tone: 'info', icon: <PackageIcon /> },
  processing: { tone: 'neutral', icon: <FlaskConicalIcon /> },
  on_hold: { tone: 'warning', icon: <CirclePauseIcon /> },
  completed: { tone: 'success', icon: <CircleCheckIcon /> },
  rejected: { tone: 'danger', icon: <CircleXIcon /> },
  discarded: { tone: 'outline', icon: <BanIcon /> },
}

const RESULT: Record<ResultStatus, Spec> = {
  pending: { tone: 'outline', icon: <CircleDashedIcon /> },
  draft: { tone: 'neutral', icon: <PencilIcon /> },
  entered: { tone: 'warning', icon: <ScanSearchIcon /> },
  reviewed: { tone: 'info', icon: <BadgeCheckIcon /> },
  validated: { tone: 'success', icon: <CircleCheckIcon /> },
  returned: { tone: 'danger', icon: <Undo2Icon /> },
  held: { tone: 'warning', icon: <CirclePauseIcon /> },
  void: { tone: 'outline', icon: <BanIcon /> },
}

const REPORT: Record<ReportStatus, Spec> = {
  draft: { tone: 'outline', icon: <PencilIcon /> },
  'pending-validation': { tone: 'warning', icon: <HourglassIcon /> },
  validated: { tone: 'info', icon: <BadgeCheckIcon /> },
  preliminary: { tone: 'info', icon: <HourglassIcon /> },
  released: { tone: 'success', icon: <FileTextIcon /> },
  'amendment-pending': { tone: 'warning', icon: <PencilIcon /> },
  corrected: { tone: 'accent', icon: <FileTextIcon /> },
  withdrawn: { tone: 'danger', icon: <BanIcon /> },
}

const CRITICAL: Record<CriticalStatus, Spec> = {
  open: { tone: 'solidDanger', icon: <BellRingIcon strokeWidth={2.2} /> },
  notified: { tone: 'warning', icon: <PhoneCallIcon /> },
  acknowledged: { tone: 'success', icon: <CircleCheckIcon /> },
  voided: { tone: 'outline', icon: <BanIcon /> },
}

const CRITICAL_STATE: Record<CriticalState, Spec> = {
  open: { tone: 'solidDanger', icon: <BellRingIcon strokeWidth={2.2} /> },
  contacting: { tone: 'danger', icon: <PhoneCallIcon /> },
  notified: { tone: 'warning', icon: <PhoneCallIcon /> },
  escalated: { tone: 'solidDanger', icon: <ChevronsUpIcon /> },
  acknowledged: { tone: 'success', icon: <CircleCheckIcon /> },
  voided: { tone: 'outline', icon: <BanIcon /> },
}

const STOCK: Record<StockStatus, Spec> = {
  'in-stock': { tone: 'success', icon: <CircleCheckIcon /> },
  'low-stock': { tone: 'warning', icon: <TriangleAlertIcon /> },
  'expiring-soon': { tone: 'warning', icon: <HourglassIcon /> },
  expired: { tone: 'danger', icon: <CircleXIcon /> },
  quarantined: { tone: 'info', icon: <LockIcon /> },
  'out-of-stock': { tone: 'danger', icon: <BanIcon /> },
}

const EQUIPMENT: Record<EquipmentStatus, Spec> = {
  operational: { tone: 'success', icon: <CircleCheckIcon /> },
  standby: { tone: 'neutral', icon: <CirclePauseIcon /> },
  maintenance: { tone: 'info', icon: <WrenchIcon /> },
  'calibration-due': { tone: 'warning', icon: <TriangleAlertIcon /> },
  'out-of-service': { tone: 'danger', icon: <CircleAlertIcon /> },
}

const QC: Record<QcResult, Spec> = {
  pass: { tone: 'success', icon: <CircleCheckIcon /> },
  warning: { tone: 'warning', icon: <TriangleAlertIcon /> },
  fail: { tone: 'danger', icon: <CircleXIcon /> },
}

type Size = 'sm' | 'md'

export function OrderStatusBadge({
  status,
  size,
}: {
  status: OrderStatus
  size?: Size
}) {
  const e = useEnum()
  const s = ORDER[status]
  return (
    <Badge tone={s.tone} size={size}>
      {s.icon}
      {e('orderStatus', status)}
    </Badge>
  )
}

export function SampleStatusBadge({
  status,
  size,
}: {
  status: SampleStatus
  size?: Size
}) {
  const e = useEnum()
  const s = SAMPLE[status]
  return (
    <Badge tone={s.tone} size={size}>
      {s.icon}
      {e('sampleStatus', status)}
    </Badge>
  )
}

export function ResultStatusBadge({
  status,
  size,
}: {
  status: ResultStatus
  size?: Size
}) {
  const e = useEnum()
  const s = RESULT[status]
  return (
    <Badge tone={s.tone} size={size}>
      {s.icon}
      {e('resultStatus', status)}
    </Badge>
  )
}

export function ReportStatusBadge({
  status,
  size,
}: {
  status: ReportStatus
  size?: Size
}) {
  const e = useEnum()
  const s = REPORT[status]
  return (
    <Badge tone={s.tone} size={size}>
      {s.icon}
      {e('reportStatus', status)}
    </Badge>
  )
}

export function CriticalStatusBadge({
  status,
  size,
}: {
  status: CriticalStatus
  size?: Size
}) {
  const e = useEnum()
  const s = CRITICAL[status]
  return (
    <Badge tone={s.tone} size={size}>
      {s.icon}
      {e('criticalStatus', status)}
    </Badge>
  )
}

/** The state staff see for a critical value (derived from what was recorded). */
export function CriticalStateBadge({
  state,
  size,
}: {
  state: CriticalState
  size?: Size
}) {
  const e = useEnum()
  const s = CRITICAL_STATE[state]
  return (
    <Badge tone={s.tone} size={size}>
      {s.icon}
      {e('criticalState', state)}
    </Badge>
  )
}

export function StockBadge({
  status,
  size,
}: {
  status: StockStatus
  size?: Size
}) {
  const e = useEnum()
  const s = STOCK[status]
  return (
    <Badge tone={s.tone} size={size}>
      {s.icon}
      {e('stockStatus', status)}
    </Badge>
  )
}

export function EquipmentBadge({
  status,
  size,
}: {
  status: EquipmentStatus
  size?: Size
}) {
  const e = useEnum()
  const s = EQUIPMENT[status]
  return (
    <Badge tone={s.tone} size={size}>
      {s.icon}
      {e('equipmentStatus', status)}
    </Badge>
  )
}

export function QcBadge({ result, size }: { result: QcResult; size?: Size }) {
  const e = useEnum()
  const s = QC[result]
  return (
    <Badge tone={s.tone} size={size}>
      {s.icon}
      {e('qcResult', result)}
    </Badge>
  )
}

export function PriorityBadge({
  priority,
  hideRoutine,
  size,
}: {
  priority: Priority
  hideRoutine?: boolean
  size?: Size
}) {
  const e = useEnum()
  if (priority === 'routine') {
    if (hideRoutine) return null
    return (
      <span className="text-xs text-fg-muted">{e('priority', priority)}</span>
    )
  }
  if (priority === 'stat')
    return (
      <Badge tone="solidDanger" size={size}>
        <ZapIcon strokeWidth={2.2} />
        {e('priority', priority)}
      </Badge>
    )
  return (
    <Badge tone="warning" size={size}>
      <ChevronsUpIcon strokeWidth={2.2} />
      {e('priority', priority)}
    </Badge>
  )
}

/** Quiet priority cue for dense tables: only STAT carries colour weight. */
export function PriorityMark({ priority }: { priority: Priority }) {
  const e = useEnum()
  if (priority === 'stat')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-danger-text uppercase">
        <span aria-hidden className="h-3.5 w-1 rounded-full bg-danger" />
        {e('priority', priority)}
      </span>
    )
  if (priority === 'urgent')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-text">
        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
        {e('priority', priority)}
      </span>
    )
  return (
    <span className="text-xs text-fg-subtle">{e('priority', priority)}</span>
  )
}

/** Shown only when an analyzer's LIS link is down. */
export function ConnectionBadge({
  connection,
  size,
}: {
  connection: 'online' | 'offline' | undefined
  size?: Size
}) {
  const e = useEnum()
  if (connection !== 'offline') return null
  return (
    <Badge tone="danger" size={size}>
      <UnplugIcon />
      {e('connection', 'offline')}
    </Badge>
  )
}
