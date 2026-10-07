import {
  DEPARTMENTS,
  ESCALATION_TARGETS,
  LANGUAGES,
  MODULES,
  SIZE_TIERS,
  type LabSettings,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  logActivity,
  requirePermission,
  type EngineCtx,
} from './core'

const TEXT_LIMITS = {
  labName: 80,
  reportHeader: 200,
  reportFooter: 240,
  labAddress: 200,
  labRegistration: 60,
  labAccreditation: 60,
} as const

export function updateSettings(
  db: LabDb,
  patch: Partial<LabSettings>,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'settings.edit')
  const next = { ...db.settings, ...patch }
  for (const [field, max] of Object.entries(TEXT_LIMITS) as [
    keyof typeof TEXT_LIMITS,
    number,
  ][]) {
    next[field] = next[field].trim()
    if (!next[field] || next[field].length > max)
      throw new LabApiError('validation-failed', { field })
  }
  if (!/^[A-Z]{2,5}$/.test(next.samplePrefix))
    throw new LabApiError('validation-failed', { field: 'samplePrefix' })
  if (
    !Number.isInteger(next.tatWarnPct) ||
    next.tatWarnPct < 50 ||
    next.tatWarnPct > 95
  )
    throw new LabApiError('validation-failed', { field: 'tatWarnPct' })
  if (
    !Number.isInteger(next.tatCriticalPct) ||
    next.tatCriticalPct < 110 ||
    next.tatCriticalPct > 300
  )
    throw new LabApiError('validation-failed', { field: 'tatCriticalPct' })
  if (
    next.defaultDepartment !== 'all' &&
    !DEPARTMENTS.includes(next.defaultDepartment)
  )
    throw new LabApiError('validation-failed', { field: 'defaultDepartment' })
  if (
    !Number.isInteger(next.criticalNotifyMin) ||
    next.criticalNotifyMin < 10 ||
    next.criticalNotifyMin > 120
  )
    throw new LabApiError('validation-failed', { field: 'criticalNotifyMin' })
  for (const field of [
    'requireIndependentReview',
    'holdReleaseForCriticals',
  ] as const)
    if (typeof next[field] !== 'boolean')
      throw new LabApiError('validation-failed', { field })
  if (
    !Number.isInteger(next.transitAlertMin) ||
    next.transitAlertMin < 15 ||
    next.transitAlertMin > 240
  )
    throw new LabApiError('validation-failed', { field: 'transitAlertMin' })
  if (!LANGUAGES.includes(next.defaultLanguage))
    throw new LabApiError('validation-failed', { field: 'defaultLanguage' })
  if (
    !Array.isArray(next.criticalEscalation) ||
    next.criticalEscalation.some(
      (t, i, all) =>
        !Number.isInteger(t.afterMin) ||
        t.afterMin < 5 ||
        t.afterMin > 24 * 60 ||
        !ESCALATION_TARGETS.includes(t.to) ||
        (i > 0 && t.afterMin <= all[i - 1]!.afterMin),
    )
  )
    throw new LabApiError('validation-failed', { field: 'criticalEscalation' })
  if (
    !Number.isInteger(next.shareLinkDays) ||
    next.shareLinkDays < 1 ||
    next.shareLinkDays > 30
  )
    throw new LabApiError('validation-failed', { field: 'shareLinkDays' })
  validateWave3(next)
  const text = (value: unknown) =>
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value)
  const changed = (Object.keys(patch) as (keyof LabSettings)[]).filter(
    (k) => text(db.settings[k]) !== text(next[k]),
  )
  const before = db.settings
  db.settings = next
  // One entry per changed field, with the old and new value.
  for (const field of changed)
    audit(db, ctx, 'settings', 'lab', 'updated', {
      from: text(before[field]),
      to: text(next[field]),
      detail: { field },
    })
  logActivity(db, ctx, 'settings-updated', {}, '/settings')
  return next
}

const bad = (field: string) => new LabApiError('validation-failed', { field })

/** Lab profile, modules, size, assistant and auto-verification switches. */
function validateWave3(next: LabSettings) {
  const p = next.profile
  if (
    !p ||
    !p.registrationNo.trim() ||
    !p.registrationAuthority.trim() ||
    !Number.isFinite(p.registrationValidFrom) ||
    !Number.isFinite(p.registrationValidTo) ||
    p.registrationValidTo <= p.registrationValidFrom
  )
    throw bad('profile')
  if (
    !p.grievanceOfficer.name.trim() ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.grievanceOfficer.email) ||
    !p.grievanceOfficer.phone.trim()
  )
    throw bad('grievanceOfficer')
  if (
    !next.modules ||
    MODULES.some((m) => typeof next.modules[m] !== 'boolean')
  )
    throw bad('modules')
  if (!SIZE_TIERS.includes(next.sizeTier)) throw bad('sizeTier')
  for (const field of ['assistantEnabled', 'autoVerifyEnabled'] as const)
    if (typeof next[field] !== 'boolean') throw bad(field)
  if (
    !Number.isInteger(next.dataRequestDays) ||
    next.dataRequestDays < 1 ||
    next.dataRequestDays > 90
  )
    throw bad('dataRequestDays')
  if (
    Object.values(next.qualityTargets).some(
      (v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100,
    )
  )
    throw bad('qualityTargets')
}
