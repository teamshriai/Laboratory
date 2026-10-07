// Access to personal health information is audited, not only changes
// (NABL 112A 7.6.3, DPDP Rule 6): who opened a patient or a report, who
// printed one, who exported a list. A backend records views as it serves
// them; the demo records them when a screen opens the record.

import type { AuditEntity } from '@/domain/types'
import type { LabDb } from '../db/schema'
import { audit, requirePermission, type EngineCtx } from './core'

export const ACCESS_KINDS = ['viewed', 'printed', 'exported'] as const
export type AccessKind = (typeof ACCESS_KINDS)[number]

export interface AccessInput {
  kind: AccessKind
  entity: AuditEntity
  /** The record, or the list's name for an export. */
  id: string
  /** Rows exported, for exports. */
  count?: number
}

/** A repeat view of the same record by the same person is noted once. */
const VIEW_WINDOW_MS = 30 * 60_000

export function recordAccess(db: LabDb, input: AccessInput, ctx: EngineCtx) {
  if (input.kind === 'exported') requirePermission(db, ctx, 'data.export')
  if (input.kind === 'viewed') {
    const recent = db.audit.find(
      (e) =>
        e.action === 'viewed' &&
        e.by === ctx.by &&
        e.entity === input.entity &&
        e.entityId === input.id,
    )
    if (recent && ctx.now - recent.at < VIEW_WINDOW_MS) return false
  }
  audit(db, ctx, input.entity, input.id, input.kind, {
    ...(input.count !== undefined ? { detail: { rows: input.count } } : {}),
  })
  return true
}
