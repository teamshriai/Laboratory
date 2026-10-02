import { nextSequence, uid, UHID_PREFIX } from '@/domain/ids'
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
  'id' | 'uhid' | 'notes' | 'registeredAt'
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
  if (!SEXES.includes(input.sex))
    throw new LabApiError('validation-failed', { field: 'sex' })
  // Two identifiers plus sex: a likely duplicate needs an explicit reason.
  const duplicate = Object.values(db.patients).find(
    (p) =>
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
  if (patch.name !== undefined && !patch.name.trim())
    throw new LabApiError('validation-failed', { field: 'name' })
  if (patch.mobile !== undefined && !/^\+?[\d\s-]{10,15}$/.test(patch.mobile))
    throw new LabApiError('validation-failed', { field: 'mobile' })
  const changed = (Object.keys(patch) as (keyof UpdatePatientInput)[]).filter(
    (k) => JSON.stringify(patient[k]) !== JSON.stringify(patch[k]),
  )
  if (changed.length === 0) return patient
  const before = structuredClone(patient)
  Object.assign(patient, patch, patch.name ? { name: patch.name.trim() } : {})
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
