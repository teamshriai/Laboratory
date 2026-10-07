// Rule-based auto-verification (NABL 112A 7.4.1.5): a rule per test lists
// the checks a result must pass. Rules are written, then approved by a
// different signatory; the lab can switch the whole feature off at once
// (the kill switch, off by default). Passing results are marked; a person
// still authorises them. No machine learning, no automatic release.

import { deltaCheck, isAbnormal, isCriticalFlag } from '@/domain/flags'
import { randomToken } from '@/domain/sha256'
import {
  AUTOVERIFY_CHECKS,
  type AutoVerifyCheck,
  type AutoVerifyRule,
  type OrderItem,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  must,
  requirePermission,
  resultsOfItem,
  type EngineCtx,
} from './core'
import { qcHoldFor } from './qc-gate'

export function activeRuleFor(db: LabDb, testId: string) {
  return Object.values(db.autoVerifyRules)
    .filter((r) => r.testId === testId && r.state === 'approved')
    .toSorted((a, b) => b.version - a.version)[0]
}

export function draftRule(
  db: LabDb,
  input: { testId: string; checks: AutoVerifyCheck[]; note?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'autoverify.manage')
  must(db.tests, input.testId, 'test')
  const checks = [...new Set(input.checks)]
  if (
    checks.length === 0 ||
    checks.some((c) => !AUTOVERIFY_CHECKS.includes(c)) ||
    // A rule never skips the critical-value check.
    !checks.includes('no-critical')
  )
    throw new LabApiError('validation-failed', { field: 'checks' })
  const versions = Object.values(db.autoVerifyRules).filter(
    (r) => r.testId === input.testId,
  )
  if (versions.some((r) => r.state === 'draft'))
    throw new LabApiError('invalid-transition', { from: 'draft' })
  const rule: AutoVerifyRule = {
    id: `avr_${randomToken(6)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')}`,
    testId: input.testId,
    version: Math.max(0, ...versions.map((r) => r.version)) + 1,
    checks,
    state: 'draft',
    createdAt: ctx.now,
    createdBy: ctx.by,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  }
  db.autoVerifyRules[rule.id] = rule
  audit(db, ctx, 'test', rule.testId, 'autoverify-rule-drafted', {
    detail: { version: rule.version, checks: checks.join(', ') },
  })
  return rule
}

/** Another signatory approves; the previous version of the rule retires. */
export function approveRule(db: LabDb, ruleId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'autoverify.approve')
  const rule = must(db.autoVerifyRules, ruleId, 'rule')
  if (rule.state !== 'draft')
    throw new LabApiError('invalid-transition', { from: rule.state })
  if (rule.createdBy === ctx.by) throw new LabApiError('independent-approval')
  for (const r of Object.values(db.autoVerifyRules))
    if (r.testId === rule.testId && r.state === 'approved') {
      r.state = 'retired'
      r.retiredAt = ctx.now
    }
  rule.state = 'approved'
  rule.approvedAt = ctx.now
  rule.approvedBy = ctx.by
  audit(db, ctx, 'test', rule.testId, 'autoverify-rule-approved', {
    detail: { version: rule.version },
  })
  return rule
}

export function retireRule(
  db: LabDb,
  ruleId: string,
  reason: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'autoverify.manage')
  const rule = must(db.autoVerifyRules, ruleId, 'rule')
  if (rule.state === 'retired') throw new LabApiError('invalid-transition', {})
  const why = reason.trim()
  if (!why) throw new LabApiError('reason-required')
  rule.state = 'retired'
  rule.retiredAt = ctx.now
  audit(db, ctx, 'test', rule.testId, 'autoverify-rule-retired', {
    reason: why,
    detail: { version: rule.version },
  })
  return rule
}

/** The patient's previous value for an analyte, from earlier orders. */
function previousValue(
  db: LabDb,
  patientId: string,
  analyteId: string,
  before: number,
) {
  let best: { at: number; value: string } | undefined
  for (const r of Object.values(db.results)) {
    if (r.analyteId !== analyteId || r.value === null || r.updatedAt >= before)
      continue
    const item = db.items[r.orderItemId]
    if (!item || item.status !== 'validated') continue
    if (db.orders[item.orderId]?.patientId !== patientId) continue
    if (!best || r.updatedAt > best.at)
      best = { at: r.updatedAt, value: r.value }
  }
  return best?.value
}

/**
 * Runs the approved rule's checks on a submitted test and records the
 * outcome on each result. Does nothing while auto-verification is off.
 */
export function applyAutoCheck(db: LabDb, item: OrderItem, ctx: EngineCtx) {
  if (!db.settings.autoVerifyEnabled) return
  const rule = activeRuleFor(db, item.testId)
  const results = resultsOfItem(db, item.id)
  if (!rule) {
    for (const r of results) delete r.autoCheck
    return
  }
  const order = db.orders[item.orderId]
  const sample = item.sampleId ? db.samples[item.sampleId] : undefined
  const failed = new Set<AutoVerifyCheck>()
  for (const r of results) {
    const analyte = db.analytes[r.analyteId]
    if (!analyte) continue
    if (rule.checks.includes('within-reference') && isAbnormal(r.flag))
      failed.add('within-reference')
    if (rule.checks.includes('no-critical') && isCriticalFlag(analyte, r.flag))
      failed.add('no-critical')
    if (
      rule.checks.includes('no-instrument-flag') &&
      (r.instrumentFlags?.length ?? 0) > 0
    )
      failed.add('no-instrument-flag')
    if (rule.checks.includes('no-delta-failure') && order && analyte.deltaPct) {
      const prev = previousValue(db, order.patientId, analyte.id, ctx.now)
      if (deltaCheck(r.value, prev, analyte.deltaPct)?.exceeded)
        failed.add('no-delta-failure')
    }
  }
  if (
    rule.checks.includes('qc-passed') &&
    sample?.equipmentId &&
    qcHoldFor(db, sample.id, sample.equipmentId)
  )
    failed.add('qc-passed')
  const outcome = {
    ruleId: rule.id,
    version: rule.version,
    passed: failed.size === 0,
    failed: [...failed],
  }
  for (const r of results) r.autoCheck = outcome
  audit(db, ctx, 'result', item.id, 'autoverify-checked', {
    to: outcome.passed ? 'passed' : 'held',
    detail: {
      test: item.testName,
      version: rule.version,
      ...(failed.size ? { failed: [...failed].join(', ') } : {}),
    },
  })
}
