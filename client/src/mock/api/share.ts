// Share links and verification pages, for the report and imaging screens
// (staff) and the public pages behind a link or a QR code.

import type { ShareLink } from '@/domain/types'
import type { LabDb } from '../db/schema'
import { linkState } from '../engine/share'
import type { ShareLinkRow } from './types'

export function shareLinkRow(
  db: LabDb,
  link: ShareLink,
  now: number,
): ShareLinkRow {
  const row: ShareLinkRow = {
    id: link.id,
    createdAt: link.createdAt,
    createdByName: db.staff[link.createdBy]?.name ?? link.createdBy,
    version: link.version,
    expiresAt: link.expiresAt,
    state: linkState(link, now),
    opened: link.access.filter((a) => a.outcome === 'opened').length,
    access: link.access.toReversed().slice(0, 20),
  }
  if (link.revokeReason) row.revokeReason = link.revokeReason
  return row
}

/** A report's links, newest first. */
export function shareLinksOf(
  db: LabDb,
  kind: ShareLink['kind'],
  targetId: string,
  now: number,
) {
  return Object.values(db.shareLinks)
    .filter((l) => l.kind === kind && l.targetId === targetId)
    .toSorted((a, b) => b.createdAt - a.createdAt)
    .map((l) => shareLinkRow(db, l, now))
}
