import { uid } from '@/domain/ids'
import { DAY } from '@/domain/time'
import type {
  EquipmentLogType,
  EquipmentStatus,
  MaintenanceKind,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  logActivity,
  must,
  notify,
  staffName,
  type EngineCtx,
  requirePermission,
} from './core'

export interface EquipmentLogInput {
  type: EquipmentLogType
  note: string
  status?: EquipmentStatus
  nextDueAt?: number
}

export function logEquipment(
  db: LabDb,
  id: string,
  input: EquipmentLogInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'equipment.manage')
  const eq = must(db.equipment, id, 'equipment')
  const note = input.note.trim()
  if (!note) throw new LabApiError('validation-failed', { field: 'note' })
  let status = input.status
  switch (input.type) {
    case 'maintenance':
      eq.lastMaintenanceAt = ctx.now
      eq.nextMaintenanceAt = input.nextDueAt ?? ctx.now + 30 * DAY
      if (eq.status === 'maintenance') status ??= 'operational'
      break
    case 'calibration':
      eq.lastCalibrationAt = ctx.now
      eq.calibrationDueAt = input.nextDueAt ?? ctx.now + 30 * DAY
      if (eq.status === 'calibration-due') status ??= 'operational'
      break
    case 'breakdown':
      status = 'out-of-service'
      break
    case 'service-visit':
    case 'status-change':
    case 'note':
      break
  }
  const previous = eq.status
  if (status) eq.status = status
  eq.log.unshift({
    id: uid('eql'),
    at: ctx.now,
    by: ctx.by,
    type: input.type,
    note,
    ...(status ? { status } : {}),
  })
  if (eq.status === 'out-of-service' && previous !== 'out-of-service')
    notify(
      db,
      ctx,
      'equipment-down',
      'danger',
      { equipment: eq.name },
      '/equipment',
    )
  audit(db, ctx, 'equipment', eq.id, input.type, {
    reason: note,
    detail: { equipment: eq.name, status: eq.status },
  })
  logActivity(
    db,
    ctx,
    'equipment-logged',
    { equipment: eq.name, type: input.type },
    '/equipment',
  )
  return eq
}

export function scheduleMaintenance(
  db: LabDb,
  id: string,
  input: {
    kind: MaintenanceKind
    dueAt: number
    title: string
    assignee: string
  },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'equipment.manage')
  const eq = must(db.equipment, id, 'equipment')
  const title = input.title.trim()
  if (!title) throw new LabApiError('validation-failed', { field: 'title' })
  if (!(input.dueAt > ctx.now - DAY))
    throw new LabApiError('validation-failed', { field: 'dueAt' })
  const task = {
    id: uid('mnt'),
    kind: input.kind,
    dueAt: input.dueAt,
    title,
    assignee: input.assignee.trim() || (eq.serviceProvider ?? ''),
    status: 'scheduled' as const,
  }
  eq.maintenancePlan = [...(eq.maintenancePlan ?? []), task].toSorted(
    (a, b) => a.dueAt - b.dueAt,
  )
  if (input.kind === 'preventive' && input.dueAt < eq.nextMaintenanceAt)
    eq.nextMaintenanceAt = input.dueAt
  eq.log.unshift({
    id: uid('eql'),
    at: ctx.now,
    by: ctx.by,
    type: 'note',
    note: title,
  })
  audit(db, ctx, 'equipment', eq.id, 'maintenance-scheduled', {
    detail: { task: title, kind: input.kind },
  })
  return task
}

export interface CompleteMaintenanceInput {
  taskId?: string
  performedAt: number
  performedBy: string
  work: string
  downtimeMin: number
  nextDueAt: number
  remarks?: string
}

/** Closes a maintenance visit, returning the analyzer to service. */
export function completeMaintenance(
  db: LabDb,
  id: string,
  input: CompleteMaintenanceInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'equipment.manage')
  const eq = must(db.equipment, id, 'equipment')
  const work = input.work.trim()
  if (!work) throw new LabApiError('validation-failed', { field: 'work' })
  if (input.performedAt > ctx.now)
    throw new LabApiError('validation-failed', { field: 'performedAt' })
  if (input.nextDueAt <= input.performedAt)
    throw new LabApiError('validation-failed', { field: 'nextDueAt' })
  if (input.downtimeMin < 0)
    throw new LabApiError('validation-failed', { field: 'downtimeMin' })
  const task = input.taskId
    ? eq.maintenancePlan?.find((t) => t.id === input.taskId)
    : undefined
  if (task) {
    task.status = 'done'
    task.completedAt = input.performedAt
  }
  const previous = eq.status
  eq.lastMaintenanceAt = input.performedAt
  eq.nextMaintenanceAt = input.nextDueAt
  if (eq.status === 'maintenance' || eq.status === 'out-of-service')
    eq.status =
      eq.calibrationDueAt <= ctx.now ? 'calibration-due' : 'operational'
  const remarks = input.remarks?.trim()
  eq.log.unshift({
    id: uid('eql'),
    at: input.performedAt,
    by: ctx.by,
    type: 'maintenance',
    note: remarks ? `${work} ${remarks}` : work,
    performedBy: input.performedBy.trim() || staffName(db, ctx.by),
    downtimeMin: Math.round(input.downtimeMin),
    ...(eq.status !== previous ? { status: eq.status } : {}),
  })
  audit(db, ctx, 'equipment', eq.id, 'maintenance-completed', {
    reason: work,
    detail: { equipment: eq.name, downtimeMin: Math.round(input.downtimeMin) },
  })
  logActivity(
    db,
    ctx,
    'equipment-logged',
    { equipment: eq.name, type: 'maintenance' },
    `/equipment?equipment=${eq.id}`,
  )
  return eq
}

export interface CalibrationInput {
  performedAt: number
  result: 'pass' | 'fail'
  certificateNo: string
  nextDueAt: number
  remarks?: string
}

export function recordCalibration(
  db: LabDb,
  id: string,
  input: CalibrationInput,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'equipment.manage')
  const eq = must(db.equipment, id, 'equipment')
  const certificateNo = input.certificateNo.trim()
  if (!certificateNo)
    throw new LabApiError('validation-failed', { field: 'certificateNo' })
  if (input.performedAt > ctx.now)
    throw new LabApiError('validation-failed', { field: 'performedAt' })
  if (input.result === 'pass' && input.nextDueAt <= input.performedAt)
    throw new LabApiError('validation-failed', { field: 'nextDueAt' })
  const remarks = input.remarks?.trim()
  const record = {
    id: uid('cal'),
    at: input.performedAt,
    by: ctx.by,
    result: input.result,
    certificateNo,
    nextDueAt: input.result === 'pass' ? input.nextDueAt : input.performedAt,
    ...(remarks ? { remarks } : {}),
  }
  eq.calibrations = [record, ...(eq.calibrations ?? [])]
  const previous = eq.status
  eq.lastCalibrationAt = input.performedAt
  if (input.result === 'pass') {
    eq.calibrationDueAt = input.nextDueAt
    if (eq.status === 'calibration-due') eq.status = 'operational'
  } else {
    eq.calibrationDueAt = input.performedAt
    if (eq.status === 'operational') eq.status = 'calibration-due'
  }
  eq.log.unshift({
    id: uid('eql'),
    at: input.performedAt,
    by: ctx.by,
    type: 'calibration',
    note: remarks ?? certificateNo,
    ...(eq.status !== previous ? { status: eq.status } : {}),
  })
  audit(db, ctx, 'equipment', eq.id, 'calibration', {
    detail: { equipment: eq.name, status: eq.status },
  })
  logActivity(
    db,
    ctx,
    'equipment-logged',
    { equipment: eq.name, type: 'calibration' },
    `/equipment?equipment=${eq.id}`,
  )
  return record
}

/**
 * Takes an analyzer offline (interface down, instrument error) or back
 * online. Offline analyzers receive no new work; samples already running on
 * it are reported so the lab can hold or re-route them.
 */
export function setConnection(
  db: LabDb,
  id: string,
  input: { connection: 'online' | 'offline'; reason: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'equipment.manage')
  const eq = must(db.equipment, id, 'equipment')
  const reason = input.reason.trim()
  if (!reason) throw new LabApiError('reason-required')
  const current = eq.connection ?? 'online'
  if (current === input.connection) throw new LabApiError('invalid-transition')
  eq.connection = input.connection
  eq.connectionChangedAt = ctx.now
  eq.connectionReason = reason
  eq.log.unshift({
    id: uid('eql'),
    at: ctx.now,
    by: ctx.by,
    type: 'status-change',
    note: `${input.connection === 'offline' ? 'Offline' : 'Back online'}: ${reason}`,
  })
  audit(db, ctx, 'equipment', eq.id, `connection-${input.connection}`, {
    reason,
    detail: { equipment: eq.name },
  })
  const running = Object.values(db.samples).filter(
    (s) => s.equipmentId === eq.id && s.status === 'processing',
  )
  if (input.connection === 'offline')
    notify(
      db,
      ctx,
      'equipment-down',
      'danger',
      { equipment: eq.name, reason, samples: running.length },
      `/equipment?equipment=${eq.id}`,
    )
  logActivity(
    db,
    ctx,
    input.connection === 'offline' ? 'equipment-offline' : 'equipment-online',
    { equipment: eq.name },
    `/equipment?equipment=${eq.id}`,
  )
  return { affected: running.length }
}
