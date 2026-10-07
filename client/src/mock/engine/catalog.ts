import { formatRange } from '@/domain/reference-ranges'
import type { Analyte, LabTest, ReferenceRange } from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  logActivity,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

/**
 * The catalog changes rarely and drives every result, so each change needs
 * the lab manager's permission and a reason, and is audited. Results keep the
 * units and reference intervals they were entered with.
 */
function catalogChange(db: LabDb, ctx: EngineCtx, reason: string) {
  requirePermission(db, ctx, 'catalog.edit')
  const text = reason.trim()
  if (!text) throw new LabApiError('reason-required')
  return text
}

const LOINC = /^\d{1,7}-\d$/

function checkLoinc(loinc: string | undefined) {
  if (loinc && !LOINC.test(loinc.trim()))
    throw new LabApiError('validation-failed', { field: 'loinc' })
}

const rangeSummary = (ranges: Omit<ReferenceRange, 'id' | 'analyteId'>[]) =>
  ranges
    .map(
      (r) =>
        `${r.sex} ${r.ageMin}-${r.ageMax}y${r.specimen ? ` ${r.specimen}` : ''}: ${formatRange(r) ?? '-'}`,
    )
    .join('; ')

export type TestInput = Omit<LabTest, 'id' | 'active' | 'analyteIds'> & {
  analyteIds?: string[]
}

/** A test's default referral lab must exist and be in use. */
function checkReferralLab(db: LabDb, labId: string | undefined) {
  if (labId === undefined || labId === '') return
  if (!db.referralLabs[labId]?.active)
    throw new LabApiError('validation-failed', { field: 'sendOutLabId' })
}

function slug(code: string) {
  return 'tst_' + code.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

export function createTest(
  db: LabDb,
  input: TestInput,
  ctx: EngineCtx,
  reason = 'New test',
): LabTest {
  const why = catalogChange(db, ctx, reason)
  checkLoinc(input.loinc)
  checkReferralLab(db, input.sendOutLabId)
  const code = input.code.trim().toUpperCase()
  if (Object.values(db.tests).some((t) => t.code.toUpperCase() === code))
    throw new LabApiError('duplicate-code', { code })
  const test: LabTest = {
    ...input,
    code,
    id: slug(code),
    active: true,
    version: 1,
    analyteIds: input.analyteIds ?? [],
  }
  db.tests[test.id] = test
  audit(db, ctx, 'test', test.id, 'created', {
    reason: why,
    to: 'v1',
    detail: { code, test: test.name },
  })
  logActivity(
    db,
    ctx,
    'test-created',
    { test: test.name, code },
    '/test-catalog',
  )
  return test
}

export function updateTest(
  db: LabDb,
  id: string,
  patch: Partial<TestInput>,
  ctx: EngineCtx,
  reason: string,
) {
  const why = catalogChange(db, ctx, reason)
  checkLoinc(patch.loinc)
  checkReferralLab(db, patch.sendOutLabId)
  const test = must(db.tests, id, 'test')
  if (patch.code) {
    const code = patch.code.trim().toUpperCase()
    if (
      Object.values(db.tests).some(
        (t) => t.id !== id && t.code.toUpperCase() === code,
      )
    )
      throw new LabApiError('duplicate-code', { code })
    patch = { ...patch, code }
  }
  const changed = (Object.keys(patch) as (keyof TestInput)[]).filter(
    (k) => JSON.stringify(test[k]) !== JSON.stringify(patch[k]),
  )
  const version = test.version ?? 1
  Object.assign(test, patch)
  // An empty referral lab means the test is done here again.
  if (!test.sendOutLabId) delete test.sendOutLabId
  if (changed.length) {
    test.version = version + 1
    audit(db, ctx, 'test', test.id, 'updated', {
      reason: why,
      from: `v${version}`,
      to: `v${version + 1}`,
      detail: { code: test.code, fields: changed.join(', ') },
    })
  }
  logActivity(
    db,
    ctx,
    'test-updated',
    { test: test.name, code: test.code },
    '/test-catalog',
  )
  return test
}

export function setTestActive(
  db: LabDb,
  id: string,
  active: boolean,
  ctx: EngineCtx,
  reason: string,
) {
  const why = catalogChange(db, ctx, reason)
  const test = must(db.tests, id, 'test')
  if (test.active !== active)
    audit(db, ctx, 'test', test.id, active ? 'activated' : 'deactivated', {
      reason: why,
      from: test.active ? 'active' : 'inactive',
      to: active ? 'active' : 'inactive',
      detail: { code: test.code },
    })
  test.active = active
  logActivity(
    db,
    ctx,
    active ? 'test-activated' : 'test-deactivated',
    { test: test.name, code: test.code },
    '/test-catalog',
  )
  return test
}

export interface RangesInput {
  ranges: Omit<ReferenceRange, 'id' | 'analyteId'>[]
  criticalLow?: number | null
  criticalHigh?: number | null
}

/** Replaces an analyte's reference ranges. Existing results keep their snapshot. */
export function saveRanges(
  db: LabDb,
  analyteId: string,
  input: RangesInput,
  ctx: EngineCtx,
  reason: string,
) {
  const why = catalogChange(db, ctx, reason)
  const analyte = must(db.analytes, analyteId, 'analyte')
  for (const r of input.ranges) {
    if (
      r.ageMin >= r.ageMax ||
      (r.low !== null && r.high !== null && r.low > r.high)
    )
      throw new LabApiError('validation-failed', { field: 'ranges' })
  }
  // Two intervals for the same sex and specimen must not cover the same age.
  input.ranges.forEach((a, i) =>
    input.ranges.slice(i + 1).forEach((b) => {
      if (
        a.sex === b.sex &&
        (a.specimen ?? '') === (b.specimen ?? '') &&
        a.ageMin < b.ageMax &&
        b.ageMin < a.ageMax
      )
        throw new LabApiError('validation-failed', { field: 'rangesOverlap' })
    }),
  )
  const previous = Object.values(db.ranges).filter(
    (r) => r.analyteId === analyteId,
  )
  for (const r of previous) delete db.ranges[r.id]
  input.ranges.forEach((r, i) => {
    const id = `rr_${analyteId}_${ctx.now.toString(36)}_${i}`
    db.ranges[id] = { ...r, id, analyteId }
  })
  if (input.criticalLow === null) delete analyte.criticalLow
  else if (input.criticalLow !== undefined)
    analyte.criticalLow = input.criticalLow
  if (input.criticalHigh === null) delete analyte.criticalHigh
  else if (input.criticalHigh !== undefined)
    analyte.criticalHigh = input.criticalHigh
  audit(db, ctx, 'analyte', analyte.id, 'ranges-updated', {
    reason: why,
    from: rangeSummary(previous),
    to: rangeSummary(input.ranges),
    detail: {
      analyte: analyte.name,
      critical: `${analyte.criticalLow ?? '-'} / ${analyte.criticalHigh ?? '-'}`,
    },
  })
  logActivity(
    db,
    ctx,
    'ranges-updated',
    { analyte: analyte.name },
    '/test-catalog',
  )
  return analyte
}

export interface NewAnalyteInput {
  name: string
  unit: string
  resultType: Extract<Analyte['resultType'], 'numeric' | 'text' | 'posneg'>
  decimals?: number
  ranges: Omit<ReferenceRange, 'id' | 'analyteId'>[]
}

/** Defines a new reportable parameter with its first reference ranges. */
export function createAnalyte(
  db: LabDb,
  input: NewAnalyteInput,
  ctx: EngineCtx,
  reason = 'New parameter',
): Analyte {
  const why = catalogChange(db, ctx, reason)
  const name = input.name.trim()
  if (name.length < 2)
    throw new LabApiError('validation-failed', { field: 'analyteName' })
  let id =
    'an_' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 24)
  while (db.analytes[id]) id += '_x'
  const analyte: Analyte = {
    id,
    name,
    unit: input.unit.trim(),
    resultType: input.resultType,
    ...(input.resultType === 'numeric'
      ? { decimals: Math.max(0, Math.min(4, input.decimals ?? 1)) }
      : {}),
  }
  db.analytes[id] = analyte
  audit(db, ctx, 'analyte', id, 'created', {
    reason: why,
    detail: { analyte: name, unit: analyte.unit },
  })
  if (input.ranges.length)
    saveRanges(db, id, { ranges: input.ranges }, ctx, why)
  return analyte
}
