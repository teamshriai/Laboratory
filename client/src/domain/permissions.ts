import type { DepartmentId, Staff, StaffRole } from './types'

/**
 * What each role may do (audit §5). There is no login in this build: the
 * person the app is "acting as" holds these permissions, and the in-browser
 * engine enforces them. That is a simulation of access control, not
 * security: a production deployment must enforce the same matrix on a server
 * that authenticates every request.
 */
export const PERMISSIONS = [
  'patient.register',
  'patient.edit',
  'order.create',
  'order.cancel',
  'label.print',
  'specimen.collect',
  'specimen.receive',
  'specimen.reject',
  'specimen.process',
  'work.assign',
  'result.enter',
  'result.rerun',
  'result.comment',
  'result.verify',
  'result.authorise',
  'report.release',
  'report.share',
  'report.amend.request',
  'report.amend.authorise',
  'report.withdraw',
  'critical.communicate',
  'qc.record',
  'equipment.manage',
  'inventory.manage',
  'catalog.edit',
  'settings.edit',
  'data.export',
  'data.reset',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const BENCH: Permission[] = [
  'label.print',
  'specimen.collect',
  'specimen.receive',
  'specimen.reject',
  'specimen.process',
  'result.enter',
  'result.rerun',
  'result.comment',
  'result.verify',
  'report.amend.request',
  'report.share',
  'critical.communicate',
  'qc.record',
  'equipment.manage',
  'inventory.manage',
]

const SIGNATORY: Permission[] = [
  'result.comment',
  'result.verify',
  'result.authorise',
  'report.release',
  'report.share',
  'report.amend.request',
  'report.amend.authorise',
  'report.withdraw',
  'critical.communicate',
  'data.export',
]

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  receptionist: [
    'patient.register',
    'patient.edit',
    'order.create',
    'order.cancel',
    'label.print',
    'report.share',
  ],
  phlebotomist: ['label.print', 'specimen.collect'],
  technician: BENCH,
  // The lab manager also holds the administrator rights (catalog, settings,
  // reset), as a small laboratory has no separate administrator.
  'lab-manager': [
    ...BENCH,
    'order.cancel',
    'work.assign',
    'catalog.edit',
    'settings.edit',
    'data.export',
    'data.reset',
  ],
  pathologist: SIGNATORY,
  microbiologist: SIGNATORY,
}

export function hasPermission(
  staff: Pick<Staff, 'role'> | undefined,
  permission: Permission,
) {
  return Boolean(staff && ROLE_PERMISSIONS[staff.role].includes(permission))
}

/** Roles that hold a permission, for "Act as a …" guidance. */
export function rolesWith(permission: Permission): StaffRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as StaffRole[]).filter((r) =>
    ROLE_PERMISSIONS[r].includes(permission),
  )
}

/**
 * Departments a signatory may authorise. A microbiologist authorises their
 * own discipline only; a pathologist authorises every department.
 */
export function canAuthoriseDepartment(
  staff: Pick<Staff, 'role' | 'department'>,
  department: DepartmentId,
) {
  if (staff.role === 'pathologist') return true
  if (staff.role === 'microbiologist')
    return department === (staff.department ?? 'microbiology')
  return false
}
