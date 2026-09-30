import type { Analyte, LabTest, ReferenceRange } from '@/domain/types'
import type { LabDb } from '../db/schema'
import { LabApiError, logActivity, must, type EngineCtx } from './core'

export type TestInput = Omit<LabTest, 'id' | 'active' | 'analyteIds'> & {
  analyteIds?: string[]
}

function slug(code: string) {
  return 'tst_' + code.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

export function createTest(
  db: LabDb,
  input: TestInput,
  ctx: EngineCtx,
): LabTest {
  const code = input.code.trim().toUpperCase()
  if (Object.values(db.tests).some((t) => t.code.toUpperCase() === code))
    throw new LabApiError('duplicate-code', { code })
  const test: LabTest = {
    ...input,
    code,
    id: slug(code),
    active: true,
    analyteIds: input.analyteIds ?? [],
  }
  db.tests[test.id] = test
  logActivity(
    db,
    ctx,
    'test-created',
    { test: test.name, code },
    '/laboratory/test-catalog',
  )
  return test
}

export function updateTest(
  db: LabDb,
  id: string,
  patch: Partial<TestInput>,
  ctx: EngineCtx,
) {
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
  Object.assign(test, patch)
  logActivity(
    db,
    ctx,
    'test-updated',
    { test: test.name, code: test.code },
    '/laboratory/test-catalog',
  )
  return test
}

export function setTestActive(
  db: LabDb,
  id: string,
  active: boolean,
  ctx: EngineCtx,
) {
  const test = must(db.tests, id, 'test')
  test.active = active
  logActivity(
    db,
    ctx,
    active ? 'test-activated' : 'test-deactivated',
    { test: test.name, code: test.code },
    '/laboratory/test-catalog',
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
) {
  const analyte = must(db.analytes, analyteId, 'analyte')
  for (const r of input.ranges) {
    if (
      r.ageMin >= r.ageMax ||
      (r.low !== null && r.high !== null && r.low > r.high)
    )
      throw new LabApiError('validation-failed', { field: 'ranges' })
  }
  for (const r of Object.values(db.ranges))
    if (r.analyteId === analyteId) delete db.ranges[r.id]
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
  logActivity(
    db,
    ctx,
    'ranges-updated',
    { analyte: analyte.name },
    '/laboratory/test-catalog',
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
): Analyte {
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
  if (input.ranges.length) saveRanges(db, id, { ranges: input.ranges }, ctx)
  return analyte
}
