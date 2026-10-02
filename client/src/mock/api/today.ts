// Today's work: one read model for the dashboard's productivity panel and
// the Lab Assistant, built from the same queues the worklists show, so
// every number here matches the screen it links to.

import { isCriticalPending } from '@/domain/critical'
import { LAB_ROUTINE } from '@/domain/lab-day'
import { HOUR, MINUTE, startOfIstDay } from '@/domain/time'
import {
  awaitsAuthorisation,
  awaitsReview,
  deriveReportStatus,
  isItemLive,
} from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import { itemsOfReport } from '../engine/core'
import type { DbIndex } from './index-cache'
import { imagingRows } from './imaging'
import { read } from './runtime'
import type {
  TodayAgendaItem,
  TodayPriority,
  TodayTodo,
  TodayView,
  WorkQueueRow,
} from './types'
import { workQueueList } from './work-queue'

const minOf = (values: (number | undefined)[]) => {
  const list = values.filter((v): v is number => v !== undefined)
  return list.length ? Math.min(...list) : undefined
}

/** When a test in the queue reaches its TAT target. */
const dueAt = (r: WorkQueueRow) =>
  r.tat?.startAt != null ? r.tat.startAt + r.tat.targetMs : undefined

export function todayView(db: LabDb, index: DbIndex, now: number): TodayView {
  const start = startOfIstDay(now)
  const end = start + 24 * HOUR
  const queue = workQueueList(db, index, now, { bucket: 'all', q: '' })
  const rows = queue.rows
  const inBucket = (b: WorkQueueRow['buckets'][number]) =>
    rows.filter((r) => r.buckets.includes(b))
  const dueToday = (list: WorkQueueRow[]) =>
    list.filter((r) => {
      const due = dueAt(r)
      return due !== undefined && due < end
    }).length
  const since = (r: WorkQueueRow) =>
    r.receivedAt ?? r.collectedAt ?? r.createdAt

  const criticals = Object.values(db.criticals).filter(isCriticalPending)
  const notifyLimit = db.settings.criticalNotifyMin * MINUTE
  const criticalOverdue = criticals.filter(
    (c) => now - c.detectedAt > notifyLimit,
  ).length

  const live = Object.values(db.items).filter(isItemLive)
  const review = live.filter(awaitsReview)
  const authorise = live.filter(
    (i) => !awaitsReview(i) && awaitsAuthorisation(i),
  )
  const itemDue = (items: typeof live) =>
    items.filter((i) => {
      const sample = i.sampleId ? db.samples[i.sampleId] : undefined
      return (
        sample?.receivedAt !== undefined &&
        sample.receivedAt + i.tatHours * HOUR < end
      )
    }).length
  const readyReports = Object.values(db.reports).filter(
    (r) => deriveReportStatus(r, itemsOfReport(db, r.id)) === 'validated',
  )
  const openQc = Object.values(db.qcEvents).filter(
    (e) => e.status !== 'resolved',
  )
  const imagingWaiting = imagingRows(db).filter((r) => r.status === 'acquired')

  const stat = inBucket('stat')
  const overdue = inBucket('overdue')
  const transit = inBucket('transit-delayed')
  const recollection = inBucket('recollection')
  const priorities: TodayPriority[] = [
    {
      key: 'critical' as const,
      severity: 'critical' as const,
      count: criticals.length,
      oldestAt: minOf(criticals.map((c) => c.detectedAt)),
      overdue: criticalOverdue,
      to: '/critical-results?status=pending',
    },
    {
      key: 'qc' as const,
      severity: 'high' as const,
      count: openQc.length,
      oldestAt: minOf(openQc.map((e) => e.openedAt)),
      to: '/quality-control',
    },
    {
      key: 'stat' as const,
      severity: 'high' as const,
      count: stat.length,
      oldestAt: minOf(stat.map(since)),
      to: '/work-queue?bucket=stat',
    },
    {
      key: 'overdue' as const,
      severity: 'high' as const,
      count: overdue.length,
      oldestAt: minOf(overdue.map(since)),
      to: '/work-queue?bucket=overdue',
    },
    {
      key: 'transit' as const,
      severity: 'medium' as const,
      count: transit.length,
      oldestAt: minOf(transit.map((r) => r.collectedAt)),
      to: '/work-queue?bucket=transit-delayed',
    },
    {
      key: 'recollection' as const,
      severity: 'medium' as const,
      count: recollection.length,
      oldestAt: minOf(recollection.map((r) => r.createdAt)),
      to: '/work-queue?bucket=recollection',
    },
    {
      key: 'authorise' as const,
      severity: 'info' as const,
      count: authorise.length,
      oldestAt: minOf(authorise.map((i) => i.reviewedAt)),
      to: '/verification?stage=authorise',
    },
    {
      key: 'imaging' as const,
      severity: 'info' as const,
      count: imagingWaiting.length,
      oldestAt: minOf(imagingWaiting.map((r) => r.performedAt)),
      to: '/imaging',
    },
  ]
    .filter((p) => p.count > 0)
    .map((p) => {
      const out: TodayPriority = {
        key: p.key,
        severity: p.severity,
        count: p.count,
        to: p.to,
      }
      if (p.oldestAt !== undefined) out.oldestAt = p.oldestAt
      if ('overdue' in p && p.overdue) out.overdue = p.overdue
      return out
    })

  const todo = (
    [
      [
        'critical',
        criticals.length,
        criticals.length,
        minOf(criticals.map((c) => c.detectedAt)),
        '/critical-results?status=pending',
      ],
      [
        'collection',
        inBucket('awaiting-collection').length,
        inBucket('awaiting-collection').length,
        minOf(
          inBucket('awaiting-collection').map((r) => r.orderedAt ?? undefined),
        ),
        '/collection',
      ],
      [
        'reception',
        inBucket('collected').length,
        dueToday(inBucket('collected')),
        minOf(inBucket('collected').map((r) => r.collectedAt)),
        '/reception?status=collected',
      ],
      [
        'entry',
        inBucket('received').length +
          inBucket('processing').length +
          inBucket('awaiting-result').length,
        dueToday([
          ...inBucket('received'),
          ...inBucket('processing'),
          ...inBucket('awaiting-result'),
        ]),
        minOf(
          [
            ...inBucket('received'),
            ...inBucket('processing'),
            ...inBucket('awaiting-result'),
          ].map(since),
        ),
        '/worklists',
      ],
      [
        'verify',
        review.length,
        itemDue(review),
        minOf(review.map((i) => i.enteredAt)),
        '/verification?stage=review',
      ],
      [
        'authorise',
        authorise.length,
        itemDue(authorise),
        minOf(authorise.map((i) => i.reviewedAt)),
        '/verification?stage=authorise',
      ],
      [
        'release',
        readyReports.length,
        readyReports.length,
        undefined,
        '/reports?status=validated&date=all',
      ],
      [
        'recollection',
        recollection.length,
        recollection.length,
        minOf(recollection.map((r) => r.createdAt)),
        '/work-queue?bucket=recollection',
      ],
    ] as const
  ).map(([key, count, due, oldestAt, to]): TodayTodo => {
    const item: TodayTodo = { key, count, dueToday: due, to }
    if (oldestAt !== undefined) item.oldestAt = oldestAt
    return item
  })

  // The agenda: the lab's routine slots and the day's real deadlines.
  const slotState = (at: number, length: number): TodayAgendaItem['state'] =>
    now >= at + length ? 'done' : now >= at ? 'now' : 'next'
  const routine: TodayAgendaItem[] = LAB_ROUTINE.map((r) => {
    const at = start + r.hour * HOUR + r.minute * MINUTE
    return {
      id: `routine-${r.key}`,
      kind: 'routine',
      key: r.key,
      at,
      state: slotState(at, HOUR),
      to: r.to,
    }
  })
  const deadlines: TodayAgendaItem[] = [
    ...criticals.map((c): TodayAgendaItem => ({
      id: `critical-${c.id}`,
      kind: 'deadline',
      key: 'critical',
      at: c.detectedAt + notifyLimit,
      state: now > c.detectedAt + notifyLimit ? 'overdue' : 'next',
      label: `${db.analytes[c.analyteId]?.name ?? c.analyteId} ${c.value} · ${db.patients[c.patientId]?.name ?? ''}`,
      to: `/critical-results?alert=${c.id}`,
    })),
    ...rows
      .filter(
        (r) =>
          (r.priority === 'stat' || r.priority === 'urgent') &&
          r.status !== 'completed' &&
          r.status !== 'rejected',
      )
      .flatMap((r): TodayAgendaItem[] => {
        const due = dueAt(r)
        if (due === undefined || due >= end) return []
        return [
          {
            id: `due-${r.id}`,
            kind: 'deadline',
            key: r.priority,
            at: due,
            state: due < now ? 'overdue' : 'next',
            label: `${r.accessionNo ?? ''} · ${r.tests.map((x) => x.shortName).join(', ')} · ${r.patient.name}`,
            to: `/work-queue?sample=${r.id}`,
          },
        ]
      }),
  ]
    .toSorted((a, b) => a.at - b.at)
    .slice(0, 6)

  const summary = {
    ordersToday: Object.values(db.orders).filter(
      (o) => o.state === 'active' && (o.orderedAt ?? 0) >= start,
    ).length,
    collected: Object.values(db.samples).filter(
      (s) => (s.collectedAt ?? 0) >= start,
    ).length,
    received: Object.values(db.samples).filter(
      (s) => (s.receivedAt ?? 0) >= start,
    ).length,
    inProgress: live.filter((i) => {
      const sample = i.sampleId ? db.samples[i.sampleId] : undefined
      return (
        i.status !== 'validated' &&
        (sample?.status === 'received' || sample?.status === 'processing')
      )
    }).length,
    verified: live.filter((i) => (i.reviewedAt ?? 0) >= start).length,
    released: Object.values(db.reports).reduce(
      (n, r) => n + r.versions.filter((v) => v.releasedAt >= start).length,
      0,
    ),
    criticals: Object.values(db.criticals).filter(
      (c) => c.status !== 'voided' && c.detectedAt >= start,
    ).length,
    rejected: Object.values(db.samples).filter(
      (s) => (s.rejection?.at ?? 0) >= start,
    ).length,
  }

  return {
    priorities,
    todo,
    agenda: [...routine, ...deadlines].toSorted((a, b) => a.at - b.at),
    summary,
  }
}

export const todayApi = {
  get: () => read((db, { index, now }) => todayView(db, index, now)),
}
