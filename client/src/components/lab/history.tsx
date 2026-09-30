import {
  Undo2Icon,
  CircleCheckIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  PackageIcon,
  CirclePauseIcon,
  PencilIcon,
  CirclePlayIcon,
  PrinterIcon,
  BanIcon,
  BadgeCheckIcon,
  SyringeIcon,
  CircleXIcon,
  CirclePlusIcon,
  ChevronsUpIcon,
  RefreshCwIcon,
  CircleUserIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { HistoryEntry } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { Timeline, type TimelineEntry } from '../ui/misc'

const ICONS: Record<string, { icon: ReactNode; tone: TimelineEntry['tone'] }> =
  {
    created: { icon: <ClipboardListIcon />, tone: 'neutral' },
    ordered: { icon: <ClipboardListIcon />, tone: 'accent' },
    'draft-saved': { icon: <PencilIcon />, tone: 'neutral' },
    'label-printed': { icon: <PrinterIcon />, tone: 'neutral' },
    collected: { icon: <SyringeIcon />, tone: 'accent' },
    received: { icon: <PackageIcon />, tone: 'accent' },
    'processing-started': { icon: <CirclePlayIcon />, tone: 'accent' },
    held: { icon: <CirclePauseIcon />, tone: 'warning' },
    resumed: { icon: <CirclePlayIcon />, tone: 'accent' },
    rejected: { icon: <CircleXIcon />, tone: 'danger' },
    'recollection-created': { icon: <RefreshCwIcon />, tone: 'warning' },
    'results-drafted': { icon: <PencilIcon />, tone: 'neutral' },
    'results-entered': { icon: <FlaskConicalIcon />, tone: 'accent' },
    validated: { icon: <BadgeCheckIcon />, tone: 'success' },
    returned: { icon: <Undo2Icon />, tone: 'warning' },
    'item-held': { icon: <CirclePauseIcon />, tone: 'warning' },
    completed: { icon: <CircleCheckIcon />, tone: 'success' },
    discarded: { icon: <BanIcon />, tone: 'neutral' },
    'test-added': { icon: <CirclePlusIcon />, tone: 'accent' },
    'tests-added': { icon: <CirclePlusIcon />, tone: 'accent' },
    'test-removed': { icon: <BanIcon />, tone: 'neutral' },
    'priority-changed': { icon: <ChevronsUpIcon />, tone: 'warning' },
    cancelled: { icon: <BanIcon />, tone: 'danger' },
    assigned: { icon: <CircleUserIcon />, tone: 'neutral' },
  }

type Entry = HistoryEntry & { byName?: string }

export function HistoryTimeline({
  entries,
  staffName,
}: {
  entries: Entry[]
  staffName?: (id: string) => string
}) {
  const t = useT('history')
  const e = useEnum()
  const f = useFormat()
  const items: TimelineEntry[] = entries.map((h) => {
    const params = { ...(h.params ?? {}) } as Record<string, string | number>
    if (h.type === 'priority-changed' && typeof params.to === 'string')
      params.to = e('priority', params.to as 'routine')
    let key = h.type
    if (h.type === 'processing-started' && params.equipment)
      key = 'processing-started-on'
    let title = t(key as Parameters<typeof t>[0], params)
    if (h.type === 'rejected' && typeof params.reason === 'string')
      title = `${title}: ${e('rejectionReason', params.reason as 'other')}`
    if (h.type === 'held' && typeof params.reason === 'string')
      title = `${title}: ${e('holdReason', params.reason as 'other')}`
    if (h.type === 'cancelled' && typeof params.reason === 'string')
      title = `${title}: ${e('cancelReason', params.reason as 'other')}`
    if (h.type === 'priority-changed' && params.to)
      title = `${title}: ${String(params.to)}`
    const spec = ICONS[h.type] ?? { icon: undefined, tone: 'neutral' as const }
    const by = h.byName ?? staffName?.(h.by) ?? ''
    return {
      id: h.id,
      title,
      meta: `${f.dateTime(h.at)}${by ? ` · ${by}` : ''}`,
      icon: spec.icon,
      tone: spec.tone,
    }
  })
  return <Timeline items={items} />
}
