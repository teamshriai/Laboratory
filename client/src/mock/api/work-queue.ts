// Bench work queue: every live sample with the queue buckets it belongs to.

import { isItemEntered, isItemLive } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import type { DbIndex } from './index-cache'
import { read } from './runtime'
import {
  WORK_BUCKETS,
  type WorkBucket,
  type WorkQueueFilters,
  type WorkQueueList,
  type WorkQueueRow,
} from './types'
import { inDateRange, matchesQuery, sampleRow } from './views'

const DONE = new Set(['completed', 'rejected'])
const PRIORITY_RANK = { stat: 0, urgent: 1, routine: 2 } as const

function queueRow(
  db: LabDb,
  index: DbIndex,
  sampleId: string,
  now: number,
): WorkQueueRow | null {
  const sample = db.samples[sampleId]!
  if (sample.status === 'discarded') return null
  const order = db.orders[sample.orderId]
  if (!order || order.state === 'draft') return null
  const row = sampleRow(db, index, sample, now)
  const items = (index.itemsBySample.get(sample.id) ?? []).filter(isItemLive)
  const entered = items.filter(isItemEntered).length
  const reviewed = items.filter(
    (i) => i.status === 'reviewed' || i.status === 'validated',
  ).length
  const validated = items.filter((i) => i.status === 'validated').length
  const openCriticals = Object.values(db.criticals).filter(
    (c) =>
      c.sampleId === sample.id &&
      c.status !== 'acknowledged' &&
      c.status !== 'voided',
  ).length
  const buckets: WorkBucket[] = ['all']
  switch (sample.status) {
    case 'pending_collection':
      buckets.push('awaiting-collection')
      if (sample.recollectionOfId) buckets.push('recollection')
      break
    case 'collected':
      buckets.push('collected')
      // Collected but not received within the lab's threshold.
      if (
        sample.collectedAt !== undefined &&
        now - sample.collectedAt > db.settings.transitAlertMin * 60_000
      )
        buckets.push('transit-delayed')
      break
    case 'received':
      buckets.push('received')
      break
    case 'processing':
      if (entered === 0) buckets.push('processing')
      else if (entered < items.length) buckets.push('awaiting-result')
      else if (reviewed < items.length) buckets.push('awaiting-review')
      else buckets.push('awaiting-authorisation')
      break
    case 'on_hold':
      buckets.push('awaiting-result')
      break
    case 'completed':
      buckets.push('completed')
      break
    case 'rejected':
      buckets.push('rejected')
      break
  }
  if (openCriticals > 0) buckets.push('critical')
  // STAT work with results still to enter (the oldest is shown first).
  if (
    order.priority === 'stat' &&
    !DONE.has(sample.status) &&
    entered < items.length
  )
    buckets.push('stat')
  if (row.tat?.state === 'breached') buckets.push('overdue')
  else if (row.tat?.state === 'approaching') buckets.push('at-risk')
  return {
    ...row,
    buckets,
    openCriticals,
    testCount: items.length,
    enteredCount: entered,
    validatedCount: validated,
  }
}

export const workQueueListApi = {
  list: (filters: WorkQueueFilters = {}) =>
    read((db, { index, now }): WorkQueueList => {
      const all = Object.keys(db.samples)
        .map((id) => queueRow(db, index, id, now))
        .filter((r): r is WorkQueueRow => r !== null)
        .filter((r) =>
          filters.department ? r.department === filters.department : true,
        )
        .filter((r) =>
          filters.priority ? r.priority === filters.priority : true,
        )
        .filter((r) =>
          filters.container ? r.container === filters.container : true,
        )
        .filter((r) =>
          filters.doctorId ? r.doctorId === filters.doctorId : true,
        )
        .filter((r) =>
          filters.encounter ? r.encounter === filters.encounter : true,
        )
        .filter((r) => (filters.ward ? r.ward === filters.ward : true))
        .filter((r) =>
          !filters.tat
            ? true
            : filters.tat === 'overdue'
              ? r.tat?.state === 'breached'
              : filters.tat === 'at-risk'
                ? r.tat?.state === 'approaching'
                : r.tat?.state === 'on-track',
        )
        .filter((r) =>
          !filters.assignee
            ? true
            : filters.assignee === 'unassigned'
              ? !r.assignedTo
              : r.assignedTo === filters.assignee,
        )
        .filter((r) =>
          inDateRange(
            r.collectedAt ?? r.orderedAt ?? r.createdAt,
            filters.date,
            now,
          ),
        )
        .filter((r) =>
          matchesQuery(filters.q, [
            r.accessionNo,
            r.orderNo,
            r.patient.name,
            r.patient.uhid,
            r.assignedName,
            ...r.tests.map((t) => t.shortName),
            ...r.tests.map((t) => t.name),
          ]),
        )
      // Old completed and rejected work would drown the live queue.
      const recent = all.filter(
        (r) =>
          !(r.status === 'completed' || r.status === 'rejected') ||
          (r.completedAt ?? r.rejection?.at ?? r.createdAt) >=
            now - 2 * 86_400_000,
      )
      const counts = Object.fromEntries(
        WORK_BUCKETS.map((b) => [b, 0]),
      ) as Record<WorkBucket, number>
      for (const r of recent) for (const b of r.buckets) counts[b] += 1
      const bucket = filters.bucket ?? 'all'
      const rows = recent
        .filter((r) => r.buckets.includes(bucket))
        .toSorted(
          (a, b) =>
            Number(DONE.has(a.status)) - Number(DONE.has(b.status)) ||
            b.openCriticals - a.openCriticals ||
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            (b.tat?.ratio ?? -1) - (a.tat?.ratio ?? -1) ||
            (a.collectedAt ?? a.createdAt) - (b.collectedAt ?? b.createdAt),
        )
      const technicians = Object.values(db.staff)
        .filter((s) => s.role === 'technician')
        .map((s) => ({
          id: s.id,
          name: s.name,
          ...(s.department ? { department: s.department } : {}),
        }))
      // Filter choices drawn from the live queue (wards, doctors in use).
      const wards = [
        ...new Set(recent.map((r) => r.ward).filter((w): w is string => !!w)),
      ].toSorted()
      const doctors = [
        ...new Map(
          recent.map((r) => [
            r.doctorId,
            { id: r.doctorId, name: r.doctorName },
          ]),
        ).values(),
      ].toSorted((a, b) => a.name.localeCompare(b.name))
      return { rows, counts, technicians, wards, doctors }
    }),
}
