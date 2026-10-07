// The signatory registry: who may sign reports, for which departments, with
// their council registration. Kept by the lab manager; every change is
// audited. A backend keeps it with the staff directory.

import {
  DEPARTMENTS,
  type DepartmentId,
  type SignatoryRegistration,
} from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

export interface SignatoryInput {
  registrationNo: string
  council: string
  departments: DepartmentId[]
  validUntil?: number
  active: boolean
}

export function updateSignatory(
  db: LabDb,
  staffId: string,
  input: SignatoryInput | null,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'signatory.manage')
  const staff = must(db.staff, staffId, 'staff')
  const before = staff.signatory
  if (input === null) {
    if (!before) return staff
    delete staff.signatory
    audit(db, ctx, 'settings', staff.id, 'signatory-removed', {
      detail: { name: staff.name },
    })
    return staff
  }
  // Only the roles that can authorise may be registered as signatories.
  if (staff.role !== 'pathologist' && staff.role !== 'microbiologist')
    throw new LabApiError('validation-failed', { field: 'role' })
  const registrationNo = input.registrationNo.trim()
  const council = input.council.trim()
  if (!registrationNo)
    throw new LabApiError('validation-failed', { field: 'registrationNo' })
  if (!council) throw new LabApiError('validation-failed', { field: 'council' })
  const departments = [...new Set(input.departments)].filter((d) =>
    DEPARTMENTS.includes(d),
  )
  if (departments.length === 0)
    throw new LabApiError('validation-failed', { field: 'departments' })
  const next: SignatoryRegistration = {
    registrationNo,
    council,
    departments,
    active: input.active,
    ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
  }
  staff.signatory = next
  audit(
    db,
    ctx,
    'settings',
    staff.id,
    before ? 'signatory-updated' : 'signatory-added',
    {
      ...(before
        ? {
            from: `${before.registrationNo} · ${before.departments.join(', ')}`,
          }
        : {}),
      to: `${registrationNo} · ${departments.join(', ')}${input.active ? '' : ' (inactive)'}`,
      detail: { name: staff.name },
    },
  )
  return staff
}
