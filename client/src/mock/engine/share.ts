// Report share links and verification pages.
//
// A share link carries an opaque random token (128 bits). Only its SHA-256
// is stored, so the database cannot rebuild a link. A link expires, can be
// revoked, asks for the patient's date of birth (five wrong answers lock it
// for half an hour) and logs every attempt. Amending or withdrawing the
// report revokes its links.
//
// Every issued report version also gets a verification page: a random token
// in the QR code, showing that the report is genuine, its version, issue
// date and content digest, and nothing about the patient.

import { isImagingReported } from '@/domain/imaging'
import { randomToken, sha256 } from '@/domain/sha256'
import { DAY, MINUTE } from '@/domain/time'
import type {
  ReportVerification,
  ShareLink,
  ShareRevokeReason,
} from '@/domain/types'
import { isReportReleased } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

export const MAX_DOB_ATTEMPTS = 5
export const LOCK_MS = 30 * MINUTE
export const MAX_LINK_DAYS = 30

export type ShareTarget = { kind: 'laboratory' | 'imaging'; id: string }

/** The report's number and current version, if it may be shared. */
function shareable(db: LabDb, target: ShareTarget) {
  if (target.kind === 'imaging') {
    const study = must(db.imaging, target.id, 'imaging')
    if (!isImagingReported(study) || !study.reportNo)
      throw new LabApiError('report-not-released')
    return {
      reportNo: study.reportNo,
      version: study.versions.at(-1)!.version,
      entity: 'imaging' as const,
    }
  }
  const report = must(db.reports, target.id, 'report')
  if (report.withdrawn) throw new LabApiError('report-withdrawn')
  if (!isReportReleased(report)) throw new LabApiError('report-not-released')
  return {
    reportNo: report.reportNo,
    version: report.versions.at(-1)!.version,
    entity: 'report' as const,
  }
}

/**
 * Creates a link. The plain token is returned once, to build the URL; it
 * is not kept.
 */
export function createShareLink(
  db: LabDb,
  target: ShareTarget,
  input: { days?: number },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'report.share')
  const { reportNo, version, entity } = shareable(db, target)
  const days = Math.min(
    MAX_LINK_DAYS,
    Math.max(1, Math.round(input.days ?? db.settings.shareLinkDays)),
  )
  const token = randomToken()
  const id = `lnk_${randomToken(9)}`
  const link: ShareLink = {
    id,
    tokenHash: sha256(token),
    kind: target.kind,
    targetId: target.id,
    reportNo,
    version,
    createdAt: ctx.now,
    createdBy: ctx.by,
    expiresAt: ctx.now + days * DAY,
    failedAttempts: 0,
    access: [],
  }
  db.shareLinks[id] = link
  audit(db, ctx, entity, target.id, 'link-created', {
    detail: { report: reportNo, version, days },
  })
  return { link, token }
}

export function revokeShareLink(
  db: LabDb,
  linkId: string,
  ctx: EngineCtx,
  reason: ShareRevokeReason = 'manual',
) {
  if (reason === 'manual') requirePermission(db, ctx, 'report.share')
  const link = must(db.shareLinks, linkId, 'link')
  if (link.revokedAt) return link
  link.revokedAt = ctx.now
  link.revokedBy = ctx.by
  link.revokeReason = reason
  audit(
    db,
    ctx,
    link.kind === 'imaging' ? 'imaging' : 'report',
    link.targetId,
    'link-revoked',
    { reason, detail: { report: link.reportNo } },
  )
  return link
}

/** An amended or withdrawn report must not stay reachable by old links. */
export function revokeLinksFor(
  db: LabDb,
  target: ShareTarget,
  reason: Exclude<ShareRevokeReason, 'manual'>,
  ctx: EngineCtx,
) {
  for (const link of Object.values(db.shareLinks))
    if (
      link.kind === target.kind &&
      link.targetId === target.id &&
      !link.revokedAt
    )
      revokeShareLink(db, link.id, ctx, reason)
}

export type LinkState = 'active' | 'expired' | 'revoked' | 'locked'

export function linkState(link: ShareLink, now: number): LinkState {
  if (link.revokedAt) return 'revoked'
  if (now >= link.expiresAt) return 'expired'
  if (link.lockedUntil && now < link.lockedUntil) return 'locked'
  return 'active'
}

export type OpenOutcome =
  | { ok: true; link: ShareLink }
  | {
      ok: false
      code:
        | 'link-not-found'
        | 'link-expired'
        | 'link-revoked'
        | 'link-locked'
        | 'dob-mismatch'
      params?: Record<string, number>
    }

/**
 * One attempt to open a link with the patient's date of birth. Refusals are
 * returned, not thrown, so the attempt (and a lock) is saved before the
 * caller reports it: a rolled-back failure could be retried forever.
 */
export function attemptShareLink(
  db: LabDb,
  token: string,
  dob: string,
  now: number,
): OpenOutcome {
  const hash = sha256(token.trim())
  const link = Object.values(db.shareLinks).find((l) => l.tokenHash === hash)
  // An unknown token gets the same answer as any wrong link.
  if (!link) return { ok: false, code: 'link-not-found' }
  const state = linkState(link, now)
  if (state !== 'active') {
    link.access.push({ at: now, outcome: state })
    if (state === 'locked')
      return {
        ok: false,
        code: 'link-locked',
        params: { minutes: Math.ceil((link.lockedUntil! - now) / MINUTE) },
      }
    return {
      ok: false,
      code: state === 'expired' ? 'link-expired' : 'link-revoked',
    }
  }
  const patientId =
    link.kind === 'imaging'
      ? db.imaging[link.targetId]?.patientId
      : db.reports[link.targetId]?.patientId
  const patient = patientId ? db.patients[patientId] : undefined
  if (!patient) return { ok: false, code: 'link-not-found' }
  if (patient.dob !== dob.trim()) {
    link.failedAttempts += 1
    link.access.push({ at: now, outcome: 'dob-mismatch' })
    if (link.failedAttempts >= MAX_DOB_ATTEMPTS) {
      link.lockedUntil = now + LOCK_MS
      link.failedAttempts = 0
      return {
        ok: false,
        code: 'link-locked',
        params: { minutes: LOCK_MS / MINUTE },
      }
    }
    return {
      ok: false,
      code: 'dob-mismatch',
      params: { left: MAX_DOB_ATTEMPTS - link.failedAttempts },
    }
  }
  link.failedAttempts = 0
  link.access.push({ at: now, outcome: 'opened' })
  return { ok: true, link }
}

/**
 * Records the verification page of an issued version: its digest (SHA-256
 * of the content as issued) behind a random token printed as a QR code.
 */
export function issueVerification(
  db: LabDb,
  input: Omit<ReportVerification, 'token' | 'digest'> & { content: unknown },
) {
  const token = randomToken()
  const { content, ...rest } = input
  const verification: ReportVerification = {
    ...rest,
    token,
    digest: sha256(JSON.stringify(content)),
  }
  db.verifications[token] = verification
  return verification
}
