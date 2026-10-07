// The lab's network: referring doctors, collection centres (NABL 111) and
// home collection visits. Every change is audited.

import { isPinCode, normaliseIndianMobile } from '@/domain/collection'
import { nextSequence } from '@/domain/ids'
import { randomToken } from '@/domain/sha256'
import { HOUR, istDayCompact } from '@/domain/time'
import {
  CENTRE_KINDS,
  CLINICAL_DEPARTMENTS,
  type CollectionCentre,
  type Doctor,
  type HomeVisit,
  type HomeVisitState,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  history,
  LabApiError,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

export type DoctorInput = Omit<Doctor, 'id'> & { id?: string }

export function saveDoctor(db: LabDb, input: DoctorInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'masters.manage')
  const name = input.name.trim()
  if (!name) throw new LabApiError('validation-failed', { field: 'name' })
  if (!CLINICAL_DEPARTMENTS.includes(input.department))
    throw new LabApiError('validation-failed', { field: 'department' })
  const phone = normaliseIndianMobile(input.phone)
  if (!phone) throw new LabApiError('invalid-mobile')
  const doctor: Doctor = {
    id:
      input.id ??
      `dr_${randomToken(6)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}`,
    name,
    department: input.department,
    qualification: input.qualification.trim(),
    phone,
    ...(input.specialty?.trim() ? { specialty: input.specialty.trim() } : {}),
    ...(input.registrationNo?.trim()
      ? { registrationNo: input.registrationNo.trim() }
      : {}),
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(input.external ? { external: true } : {}),
    ...(input.clinic?.trim() ? { clinic: input.clinic.trim() } : {}),
    ...(input.active === false ? { active: false } : {}),
  }
  const existed = Boolean(input.id && db.doctors[input.id])
  db.doctors[doctor.id] = doctor
  audit(
    db,
    ctx,
    'settings',
    doctor.id,
    existed ? 'doctor-updated' : 'doctor-added',
    {
      detail: { name: doctor.name },
    },
  )
  return doctor
}

export type CentreInput = Omit<CollectionCentre, 'id'> & { id?: string }

export function saveCentre(db: LabDb, input: CentreInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'masters.manage')
  const name = input.name.trim()
  const code = input.code.trim().toUpperCase()
  if (!name || !code)
    throw new LabApiError('validation-failed', { field: 'name' })
  if (!CENTRE_KINDS.includes(input.kind))
    throw new LabApiError('validation-failed', { field: 'kind' })
  if (!isPinCode(input.pinCode)) throw new LabApiError('invalid-pin')
  if (!input.inchargeName.trim())
    throw new LabApiError('validation-failed', { field: 'incharge' })
  if (
    !Number.isInteger(input.transitMin) ||
    input.transitMin < 0 ||
    input.transitMin > 24 * 60
  )
    throw new LabApiError('validation-failed', { field: 'transitMin' })
  if (input.accountId && !db.accounts[input.accountId])
    throw new LabApiError('validation-failed', { field: 'account' })
  if (
    Object.values(db.centres).some((c) => c.code === code && c.id !== input.id)
  )
    throw new LabApiError('duplicate-code', { code })
  const centre: CollectionCentre = {
    ...input,
    id:
      input.id ??
      `cc_${randomToken(6)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}`,
    code,
    name,
    pinCode: input.pinCode.trim(),
    inchargeName: input.inchargeName.trim(),
  }
  const existed = Boolean(input.id && db.centres[input.id])
  db.centres[centre.id] = centre
  audit(
    db,
    ctx,
    'settings',
    centre.id,
    existed ? 'centre-updated' : 'centre-added',
    {
      detail: { name: centre.name, code: centre.code },
    },
  )
  return centre
}

// ---------- Home collection ----------

export interface BookVisitInput {
  patientId: string
  orderId?: string
  address: string
  pinCode: string
  landmark?: string
  slotStart: number
  /** Minutes; one hour by default. */
  slotMinutes?: number
  notes?: string
}

export function bookHomeVisit(
  db: LabDb,
  input: BookVisitInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'home.book')
  const patient = must(db.patients, input.patientId, 'patient')
  if (patient.mergedInto) throw new LabApiError('patient-merged')
  if (input.orderId) {
    const order = must(db.orders, input.orderId, 'order')
    if (order.patientId !== patient.id)
      throw new LabApiError('validation-failed', { field: 'order' })
  }
  const address = input.address.trim()
  if (!address) throw new LabApiError('validation-failed', { field: 'address' })
  if (!isPinCode(input.pinCode)) throw new LabApiError('invalid-pin')
  const minutes = input.slotMinutes ?? 60
  if (
    !Number.isFinite(input.slotStart) ||
    input.slotStart < ctx.now - 5 * 60_000 ||
    input.slotStart > ctx.now + 30 * 24 * HOUR ||
    minutes < 15 ||
    minutes > 240
  )
    throw new LabApiError('slot-invalid')
  const visit: HomeVisit = {
    id: `hv_${randomToken(9)}`,
    visitNo: nextSequence(
      Object.values(db.homeVisits).map((v) => v.visitNo),
      `HV-${istDayCompact(input.slotStart)}-`,
      3,
    ),
    patientId: patient.id,
    ...(input.orderId ? { orderId: input.orderId } : {}),
    address,
    pinCode: input.pinCode.trim(),
    ...(input.landmark?.trim() ? { landmark: input.landmark.trim() } : {}),
    slotStart: input.slotStart,
    slotEnd: input.slotStart + minutes * 60_000,
    state: 'booked',
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    createdAt: ctx.now,
    createdBy: ctx.by,
    history: [history(ctx, 'visit-booked')],
  }
  db.homeVisits[visit.id] = visit
  audit(db, ctx, 'patient', patient.id, 'home-visit-booked', {
    detail: { visit: visit.visitNo, slot: `time:${visit.slotStart}` },
  })
  return visit
}

export function assignHomeVisit(
  db: LabDb,
  visitId: string,
  phlebotomistId: string,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'home.dispatch')
  const visit = must(db.homeVisits, visitId, 'visit')
  if (visit.state !== 'booked' && visit.state !== 'assigned')
    throw new LabApiError('visit-state')
  const staff = must(db.staff, phlebotomistId, 'staff')
  if (staff.role !== 'phlebotomist')
    throw new LabApiError('validation-failed', { field: 'phlebotomist' })
  visit.phlebotomistId = staff.id
  visit.state = 'assigned'
  visit.history.push(history(ctx, 'visit-assigned', { name: staff.name }))
  audit(db, ctx, 'patient', visit.patientId, 'home-visit-assigned', {
    to: staff.name,
    detail: { visit: visit.visitNo },
  })
  return visit
}

const NEXT: Partial<Record<HomeVisitState, HomeVisitState[]>> = {
  booked: ['cancelled'],
  assigned: ['en-route', 'cancelled', 'missed'],
  'en-route': ['collected', 'missed'],
}

/**
 * The phlebotomist moves their visit along: on the way, collected (with
 * proof) or missed; the desk may cancel. Collected needs the cold chain
 * answer and who signed for it.
 */
export function updateHomeVisit(
  db: LabDb,
  visitId: string,
  input: {
    state: Exclude<HomeVisitState, 'booked' | 'assigned'>
    reason?: string
    proof?: { coldChain: boolean; receivedBy: string; note?: string }
  },
  ctx: EngineCtx,
) {
  const visit = must(db.homeVisits, visitId, 'visit')
  if (input.state === 'cancelled') requirePermission(db, ctx, 'home.book')
  else {
    requirePermission(db, ctx, 'specimen.collect')
    if (visit.phlebotomistId !== ctx.by) throw new LabApiError('visit-state')
  }
  if (!NEXT[visit.state]?.includes(input.state))
    throw new LabApiError('visit-state')
  const from = visit.state
  if (input.state === 'collected') {
    const receivedBy = input.proof?.receivedBy.trim()
    if (!input.proof || !receivedBy)
      throw new LabApiError('validation-failed', { field: 'proof' })
    visit.proof = {
      at: ctx.now,
      by: ctx.by,
      coldChain: input.proof.coldChain,
      receivedBy,
      ...(input.proof.note?.trim() ? { note: input.proof.note.trim() } : {}),
    }
  }
  if (input.state === 'cancelled' || input.state === 'missed') {
    const reason = input.reason?.trim()
    if (!reason) throw new LabApiError('reason-required')
    visit.cancelReason = reason
  }
  visit.state = input.state
  visit.history.push(history(ctx, `visit-${input.state}`))
  audit(db, ctx, 'patient', visit.patientId, `home-visit-${input.state}`, {
    from,
    to: input.state,
    ...(visit.cancelReason && input.state !== 'collected'
      ? { reason: visit.cancelReason }
      : {}),
    detail: {
      visit: visit.visitNo,
      ...(visit.proof && input.state === 'collected'
        ? { coldChain: visit.proof.coldChain ? 'yes' : 'no' }
        : {}),
    },
  })
  return visit
}
