import { nextSequence, uid, UHID_PREFIX } from '@/domain/ids'
import {
  isAbhaAddress,
  isPinCode,
  normaliseAbhaNumber,
  normaliseIndianMobile,
} from '@/domain/collection'
import { ageInYears } from '@/domain/time'
import { SEXES, type Patient } from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  history,
  LabApiError,
  logActivity,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

export type RegisterPatientInput = Omit<
  Patient,
  | 'id'
  | 'uhid'
  | 'notes'
  | 'registeredAt'
  | 'mergedInto'
  | 'mergedAt'
  | 'history'
> & {
  note?: string
  /**
   * Why a patient matching an existing record (same name, date of birth and
   * sex) is registered anyway. Without it such a registration is refused.
   */
  duplicateReason?: string
}

const normalName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Contact and identifier fields, normalised: an Indian mobile number, an
 * optional PIN code and optional ABHA (never Aadhaar).
 */
function checkIdentifiers<
  T extends { mobile?: string; pinCode?: string; abha?: Patient['abha'] },
>(input: T): T {
  const out = { ...input }
  if (input.mobile !== undefined) {
    const mobile = normaliseIndianMobile(input.mobile)
    if (!mobile) throw new LabApiError('invalid-mobile')
    out.mobile = mobile
  }
  if (input.pinCode !== undefined) {
    const pin = input.pinCode.trim()
    if (pin && !isPinCode(pin)) throw new LabApiError('invalid-pin')
    if (pin) out.pinCode = pin
    else delete out.pinCode
  }
  if (input.abha !== undefined) {
    const number = input.abha.number?.trim()
    const address = input.abha.address?.trim().toLowerCase()
    const abha: NonNullable<Patient['abha']> = {}
    if (number) {
      const normalised = normaliseAbhaNumber(number)
      if (!normalised) throw new LabApiError('invalid-abha')
      abha.number = normalised
    }
    if (address) {
      if (!isAbhaAddress(address)) throw new LabApiError('invalid-abha')
      abha.address = address
    }
    if (abha.number || abha.address) out.abha = abha
    else delete out.abha
  }
  return out
}

/** Date of birth: a real date, not in the future and at most 120 years ago. */
function checkDob(dob: string, now: number) {
  const at = Date.parse(dob)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(at) || at > now)
    throw new LabApiError('validation-failed', { field: 'dob' })
  if (ageInYears(dob, now) > 120)
    throw new LabApiError('validation-failed', { field: 'dob' })
}

export function registerPatient(
  db: LabDb,
  input: RegisterPatientInput,
  ctx: EngineCtx,
): Patient {
  requirePermission(db, ctx, 'patient.register')
  const name = input.name.trim()
  if (!name) throw new LabApiError('validation-failed', { field: 'name' })
  checkDob(input.dob, ctx.now)
  input = checkIdentifiers(input)
  if (!SEXES.includes(input.sex))
    throw new LabApiError('validation-failed', { field: 'sex' })
  // Two identifiers plus sex: a likely duplicate needs an explicit reason.
  const duplicate = Object.values(db.patients).find(
    (p) =>
      !p.mergedInto &&
      normalName(p.name) === normalName(name) &&
      p.dob === input.dob &&
      p.sex === input.sex,
  )
  const duplicateReason = input.duplicateReason?.trim()
  if (duplicate && !duplicateReason)
    throw new LabApiError('possible-duplicate', {
      uhid: duplicate.uhid,
      id: duplicate.id,
    })
  const uhid = nextSequence(
    Object.values(db.patients).map((p) => p.uhid),
    UHID_PREFIX,
    6,
  )
  const { note, duplicateReason: _ignored, ...rest } = input
  const patient: Patient = {
    ...rest,
    name,
    id: `pat_${uhid.slice(UHID_PREFIX.length)}`,
    uhid,
    notes: note?.trim()
      ? [{ id: uid('note'), at: ctx.now, by: ctx.by, text: note.trim() }]
      : [],
    registeredAt: ctx.now,
  }
  db.patients[patient.id] = patient
  audit(db, ctx, 'patient', patient.id, 'registered', {
    detail: { uhid, ...(duplicate ? { similarTo: duplicate.uhid } : {}) },
    ...(duplicate && duplicateReason ? { reason: duplicateReason } : {}),
  })
  logActivity(
    db,
    ctx,
    'patient-registered',
    { patient: patient.name, uhid },
    `/patients/${patient.id}`,
  )
  return patient
}

export function addClinicalNote(
  db: LabDb,
  patientId: string,
  text: string,
  ctx: EngineCtx,
) {
  const patient = must(db.patients, patientId, 'patient')
  const trimmed = text.trim()
  if (!trimmed) throw new LabApiError('validation-failed', { field: 'text' })
  patient.notes.unshift({
    id: uid('note'),
    at: ctx.now,
    by: ctx.by,
    text: trimmed,
  })
  return patient
}

export type UpdatePatientInput = Partial<
  Pick<
    Patient,
    | 'name'
    | 'mobile'
    | 'email'
    | 'bloodGroup'
    | 'allergies'
    | 'city'
    | 'state'
    | 'pinCode'
    | 'abha'
    | 'encounter'
    | 'preferredLanguage'
  >
>

/** Corrects registration details; every change is kept in history. */
export function updatePatient(
  db: LabDb,
  patientId: string,
  patch: UpdatePatientInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'patient.edit')
  const patient = must(db.patients, patientId, 'patient')
  if (patient.mergedInto) throw new LabApiError('patient-merged')
  if (patch.name !== undefined && !patch.name.trim())
    throw new LabApiError('validation-failed', { field: 'name' })
  // A blank PIN or ABHA clears the stored one.
  const clears: ('pinCode' | 'abha')[] = []
  if (patch.pinCode !== undefined && !patch.pinCode.trim() && patient.pinCode)
    clears.push('pinCode')
  if (
    patch.abha !== undefined &&
    !patch.abha.number?.trim() &&
    !patch.abha.address?.trim() &&
    patient.abha
  )
    clears.push('abha')
  patch = checkIdentifiers(patch)
  const changed = [
    ...(Object.keys(patch) as (keyof UpdatePatientInput)[]).filter(
      (k) => JSON.stringify(patient[k]) !== JSON.stringify(patch[k]),
    ),
    ...clears,
  ]
  if (changed.length === 0) return patient
  const before = structuredClone(patient)
  Object.assign(patient, patch, patch.name ? { name: patch.name.trim() } : {})
  for (const field of clears) delete patient[field]
  patient.history = [
    ...(patient.history ?? []),
    history(ctx, 'patient-updated', { fields: changed.join(', ') }),
  ]
  for (const field of changed)
    audit(db, ctx, 'patient', patient.id, 'updated', {
      from: displayValue(before[field]),
      to: displayValue(patch[field]),
      detail: { field },
    })
  return patient
}

/** A changed registration value, as text for the audit log. */
function displayValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string' || typeof value === 'number') return `${value}`
  return JSON.stringify(value)
}

/**
 * Merges a duplicate registration into the record that stays. Orders,
 * specimens, reports, critical values, imaging, consents and notes move
 * across; the duplicate stays, read-only, pointing at the survivor so old
 * UHIDs still lead somewhere. Audited on both records with the reason.
 */
export function mergePatients(
  db: LabDb,
  input: { survivorId: string; duplicateId: string; reason: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'patient.merge')
  if (input.survivorId === input.duplicateId)
    throw new LabApiError('merge-same-patient')
  const survivor = must(db.patients, input.survivorId, 'patient')
  const duplicate = must(db.patients, input.duplicateId, 'patient')
  if (survivor.mergedInto || duplicate.mergedInto)
    throw new LabApiError('patient-merged')
  const reason = input.reason.trim()
  if (!reason) throw new LabApiError('reason-required')

  const move = <T extends { patientId: string }>(rows: Record<string, T>) => {
    let n = 0
    for (const row of Object.values(rows))
      if (row.patientId === duplicate.id) {
        row.patientId = survivor.id
        n += 1
      }
    return n
  }
  const moved = {
    orders: move(db.orders),
    specimens: move(db.samples),
    reports: move(db.reports),
    criticals: move(db.criticals),
    imaging: move(db.imaging),
    consents: move(db.consents),
  }
  survivor.notes = [...survivor.notes, ...duplicate.notes].toSorted(
    (a, b) => a.at - b.at,
  )
  survivor.allergies = [
    ...new Set([...survivor.allergies, ...duplicate.allergies]),
  ]
  survivor.abha ??= duplicate.abha
  survivor.pinCode ??= duplicate.pinCode
  survivor.history = [
    ...(survivor.history ?? []),
    history(ctx, 'patient-merged', { uhid: duplicate.uhid }),
  ]
  duplicate.mergedInto = survivor.id
  duplicate.mergedAt = ctx.now
  duplicate.notes = []
  const detail = {
    from: duplicate.uhid,
    to: survivor.uhid,
    ...moved,
  }
  audit(db, ctx, 'patient', survivor.id, 'merged-in', { reason, detail })
  audit(db, ctx, 'patient', duplicate.id, 'merged-into', { reason, detail })
  return survivor
}
