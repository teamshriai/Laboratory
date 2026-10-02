import { DEPARTMENTS, LANGUAGES, type LabSettings } from '@/domain/types'
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
  const changed = (Object.keys(patch) as (keyof LabSettings)[]).filter(
    (k) => db.settings[k] !== next[k],
  )
  const before = db.settings
  db.settings = next
  // One entry per changed field, with the old and new value.
  for (const field of changed)
    audit(db, ctx, 'settings', 'lab', 'updated', {
      from: String(before[field]),
      to: String(next[field]),
      detail: { field },
    })
  logActivity(db, ctx, 'settings-updated', {}, '/settings')
  return next
}
