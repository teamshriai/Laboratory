// Shared plumbing for the in-browser "backend": the execution context, typed
// errors, lookups and the activity / notification feeds.

import { uid } from '@/domain/ids'
import { hasPermission, rolesWith, type Permission } from '@/domain/permissions'
import { ageInYears } from '@/domain/time'
import type {
  AuditEntity,
  HistoryEntry,
  LabNotification,
  NotificationType,
  Severity,
  Staff,
} from '@/domain/types'
import {
  MAX_AUDIT_ENTRIES,
  MAX_FEED_ENTRIES,
  type LabDb,
  type Table,
} from '../db/schema'

export interface EngineCtx {
  /** Time of the action (seed actions use times in the past). */
  now: number
  /** Staff id performing the action. */
  by: string
}

/** Error codes map to `errors.<code>` in the i18n catalog. */
export const ERROR_CODES = [
  'not-found',
  'invalid-transition',
  'validation-failed',
  'order-empty',
  'test-inactive',
  'duplicate-test',
  'order-has-validated-results',
  'item-already-validated',
  'sample-not-collected',
  'sample-already-received',
  'sample-not-in-lab',
  'results-incomplete',
  'not-authorized-validator',
  'report-not-validated',
  'report-not-released',
  'critical-unacknowledged',
  'equipment-unavailable',
  'duplicate-code',
  'insufficient-stock',
  'simulated-failure',
  'storage-full',
  'not-authorized-reviewer',
  'not-authorized-releaser',
  'self-review-not-allowed',
  'not-reviewed',
  'sample-on-hold',
  'reason-required',
  'readback-required',
  'analyzer-offline',
  'qc-hold',
  'lot-not-usable',
  'order-closed',
  'amendment-pending',
  'no-amendment-pending',
  'not-permitted',
  'outside-discipline',
  'possible-duplicate',
  'implausible-value',
  'not-numeric',
  'order-in-lab',
  'test-resulted',
  'not-yet-collected',
  'nothing-authorised',
  'report-withdrawn',
  'collection-in-future',
  'collection-before-order',
  'collection-time-reason',
  'received-before-collected',
  'recipient-full-name',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export class LabApiError extends Error {
  code: ErrorCode
  params: Record<string, string | number>

  constructor(code: ErrorCode, params: Record<string, string | number> = {}) {
    super(code)
    this.name = 'LabApiError'
    this.code = code
    this.params = params
  }
}

export function must<T>(
  table: Table<T>,
  id: string | null | undefined,
  entity: string,
): T {
  const row = id ? table[id] : undefined
  if (!row) throw new LabApiError('not-found', { entity, id: id ?? '' })
  return row
}

export function history(
  ctx: EngineCtx,
  type: string,
  params?: HistoryEntry['params'],
): HistoryEntry {
  const entry: HistoryEntry = { id: uid('h'), at: ctx.now, by: ctx.by, type }
  if (params) entry.params = params
  return entry
}

export function logActivity(
  db: LabDb,
  ctx: EngineCtx,
  type: string,
  params: Record<string, string | number>,
  link?: string,
) {
  db.activity.unshift({
    id: uid('act'),
    at: ctx.now,
    by: ctx.by,
    type,
    params,
    ...(link ? { link } : {}),
  })
  if (db.activity.length > MAX_FEED_ENTRIES)
    db.activity.length = MAX_FEED_ENTRIES
}

/**
 * Records a significant action in the durable, append-only audit log: who,
 * when, what, the state before and after, and why.
 */
export function audit(
  db: LabDb,
  ctx: EngineCtx,
  entity: AuditEntity,
  entityId: string,
  action: string,
  extra: {
    reason?: string
    from?: string
    to?: string
    detail?: Record<string, string | number>
  } = {},
) {
  db.audit.unshift({
    id: uid('aud'),
    at: ctx.now,
    by: ctx.by,
    entity,
    entityId,
    action,
    ...(extra.reason ? { reason: extra.reason } : {}),
    ...(extra.from ? { from: extra.from } : {}),
    ...(extra.to ? { to: extra.to } : {}),
    ...(extra.detail ? { detail: extra.detail } : {}),
  })
  if (db.audit.length > MAX_AUDIT_ENTRIES) db.audit.length = MAX_AUDIT_ENTRIES
}

/**
 * The acting staff member, refused unless their role holds `permission`
 * (domain/permissions.ts). The message names who they are and which roles
 * can do it, so the user knows whom to switch to.
 */
export function requirePermission(
  db: LabDb,
  ctx: EngineCtx,
  permission: Permission,
): Staff {
  const staff = db.staff[ctx.by]
  if (!staff || !hasPermission(staff, permission))
    throw new LabApiError('not-permitted', {
      name: staff?.name ?? ctx.by,
      role: staff ? `enum:staffRole.${staff.role}` : '',
      action: `enum:permission.${permission}`,
      roles: rolesWith(permission)
        .map((r) => `enum:staffRole.${r}`)
        .join('|'),
    })
  return staff
}

export function notify(
  db: LabDb,
  ctx: EngineCtx,
  type: NotificationType,
  severity: Severity,
  params: Record<string, string | number>,
  link: string,
) {
  const n: LabNotification = {
    id: uid('ntf'),
    type,
    at: ctx.now,
    params,
    link,
    severity,
    read: false,
  }
  db.notifications.unshift(n)
  if (db.notifications.length > MAX_FEED_ENTRIES)
    db.notifications.length = MAX_FEED_ENTRIES
}

export function patientAge(db: LabDb, patientId: string, now: number) {
  const p = must(db.patients, patientId, 'patient')
  return ageInYears(p.dob, now)
}

// ---- Scans (small tables; clarity over speed) ----

export const itemsOfOrder = (db: LabDb, orderId: string) =>
  Object.values(db.items).filter((i) => i.orderId === orderId)

export const itemsOfSample = (db: LabDb, sampleId: string) =>
  Object.values(db.items).filter((i) => i.sampleId === sampleId)

export const itemsOfReport = (db: LabDb, reportId: string) =>
  Object.values(db.items).filter((i) => i.reportId === reportId)

export const samplesOfOrder = (db: LabDb, orderId: string) =>
  Object.values(db.samples).filter((s) => s.orderId === orderId)

export const resultsOfItem = (db: LabDb, itemId: string) =>
  Object.values(db.results).filter((r) => r.orderItemId === itemId)

export const rangesOfAnalyte = (db: LabDb, analyteId: string) =>
  Object.values(db.ranges).filter((r) => r.analyteId === analyteId)

export function staffName(db: LabDb, id: string) {
  return db.staff[id]?.name ?? id
}
