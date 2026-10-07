// Patient consent: for tests that need it (HIV counselling, invasive
// procedures: NABL 112A 6(h)) and, under the DPDP Act, for each purpose the
// lab processes health data for. Consents are kept, never edited: a change
// of mind is a withdrawal on record.

import { randomToken } from '@/domain/sha256'
import {
  CONSENT_METHODS,
  CONSENT_PURPOSES,
  LANGUAGES,
  type ConsentMethod,
  type ConsentPurpose,
  type ConsentRecord,
  type Language,
  type OrderItem,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

export interface ConsentInput {
  purpose: ConsentPurpose
  status: 'granted' | 'refused'
  method: ConsentMethod
  language: Language
  /** When the patient gave or refused it (not in the future). */
  at: number
  /** Full name of the witness, for verbal consent. */
  witness?: string
  /** For a test procedure: the tests it covers. */
  orderItemIds?: string[]
  notes?: string
}

export function recordConsent(
  db: LabDb,
  patientId: string,
  input: ConsentInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'consent.record')
  const patient = must(db.patients, patientId, 'patient')
  if (patient.mergedInto) throw new LabApiError('patient-merged')
  if (
    !CONSENT_PURPOSES.includes(input.purpose) ||
    !CONSENT_METHODS.includes(input.method) ||
    !LANGUAGES.includes(input.language)
  )
    throw new LabApiError('validation-failed', { field: 'consent' })
  if (input.at > ctx.now)
    throw new LabApiError('validation-failed', { field: 'time' })
  const witness = input.witness?.trim()
  if (
    input.method === 'verbal-witnessed' &&
    (!witness || !witness.includes(' '))
  )
    throw new LabApiError('validation-failed', { field: 'witness' })
  const itemIds = input.orderItemIds ?? []
  if (input.purpose === 'test-procedure') {
    if (itemIds.length === 0)
      throw new LabApiError('validation-failed', { field: 'tests' })
    for (const id of itemIds) {
      const item = must(db.items, id, 'test')
      if (db.orders[item.orderId]?.patientId !== patientId)
        throw new LabApiError('validation-failed', { field: 'tests' })
    }
  }
  const record: ConsentRecord = {
    id: `con_${randomToken(9)}`,
    patientId,
    purpose: input.purpose,
    status: input.status,
    method: input.method,
    language: input.language,
    at: input.at,
    recordedBy: ctx.by,
    recordedAt: ctx.now,
    ...(witness ? { witness } : {}),
    ...(itemIds.length ? { orderItemIds: itemIds } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  }
  db.consents[record.id] = record
  audit(db, ctx, 'patient', patientId, `consent-${input.status}`, {
    detail: {
      purpose: input.purpose,
      method: input.method,
      ...(itemIds.length
        ? {
            tests: itemIds.map((id) => db.items[id]?.testName ?? id).join(', '),
          }
        : {}),
    },
  })
  return record
}

export function withdrawConsent(
  db: LabDb,
  consentId: string,
  reason: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'consent.record')
  const record = must(db.consents, consentId, 'consent')
  if (record.status !== 'granted') throw new LabApiError('invalid-transition')
  const text = reason.trim()
  if (!text) throw new LabApiError('reason-required')
  record.status = 'withdrawn'
  record.withdrawnAt = ctx.now
  record.withdrawnBy = ctx.by
  record.withdrawReason = text
  audit(db, ctx, 'patient', record.patientId, 'consent-withdrawn', {
    reason: text,
    detail: { purpose: record.purpose },
  })
  return record
}

/** A test that needs consent has a granted, not withdrawn, one covering it. */
export function hasTestConsent(db: LabDb, item: OrderItem) {
  return Object.values(db.consents).some(
    (c) =>
      c.purpose === 'test-procedure' &&
      c.status === 'granted' &&
      c.orderItemIds?.includes(item.id),
  )
}

/** Live tests of a specimen that need consent and do not have it. */
export function testsMissingConsent(db: LabDb, items: OrderItem[]) {
  return items.filter(
    (item) =>
      db.tests[item.testId]?.consentRequired && !hasTestConsent(db, item),
  )
}
