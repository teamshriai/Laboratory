import type { LabDb } from '../db/schema'

export function markNotificationsRead(db: LabDb, ids: string[]) {
  const set = new Set(ids)
  for (const n of db.notifications) if (set.has(n.id)) n.read = true
}

export function markAllNotificationsRead(
  db: LabDb,
  summaries: Record<string, number>,
) {
  for (const n of db.notifications) n.read = true
  Object.assign(db.summaryReads, summaries)
}

export function markSummaryRead(db: LabDb, key: string, count: number) {
  db.summaryReads[key] = count
}
