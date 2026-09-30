import { nextSequence, uid, UHID_PREFIX } from '@/domain/ids'
import type { Patient } from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  history,
  LabApiError,
  logActivity,
  must,
  type EngineCtx,
} from './core'

export type RegisterPatientInput = Omit<
  Patient,
  'id' | 'uhid' | 'notes' | 'registeredAt'
> & {
  note?: string
}

export function registerPatient(
  db: LabDb,
  input: RegisterPatientInput,
  ctx: EngineCtx,
): Patient {
  const name = input.name.trim()
  if (!name) throw new LabApiError('validation-failed', { field: 'name' })
  const uhid = nextSequence(
    Object.values(db.patients).map((p) => p.uhid),
    UHID_PREFIX,
    6,
  )
  const { note, ...rest } = input
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
  audit(db, ctx, 'patient', patient.id, 'registered', { detail: { uhid } })
  logActivity(
    db,
    ctx,
    'patient-registered',
    { patient: patient.name, uhid },
    `/laboratory/patients/${patient.id}`,
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
  const patient = must(db.patients, patientId, 'patient')
  if (patch.name !== undefined && !patch.name.trim())
    throw new LabApiError('validation-failed', { field: 'name' })
  if (patch.mobile !== undefined && !/^\+?[\d\s-]{10,15}$/.test(patch.mobile))
    throw new LabApiError('validation-failed', { field: 'mobile' })
  const changed = (Object.keys(patch) as (keyof UpdatePatientInput)[]).filter(
    (k) => JSON.stringify(patient[k]) !== JSON.stringify(patch[k]),
  )
  if (changed.length === 0) return patient
  Object.assign(patient, patch, patch.name ? { name: patch.name.trim() } : {})
  patient.history = [
    ...(patient.history ?? []),
    history(ctx, 'patient-updated', { fields: changed.join(', ') }),
  ]
  audit(db, ctx, 'patient', patient.id, 'updated', {
    detail: { fields: changed.join(', ') },
  })
  return patient
}
