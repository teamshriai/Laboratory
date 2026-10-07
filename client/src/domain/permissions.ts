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
  'patient.merge',
  'consent.record',
  'order.create',
  'order.cancel',
  'label.print',
  'specimen.collect',
  'specimen.receive',
  'specimen.reject',
  'specimen.process',
  'specimen.split',
  'specimen.send-out',
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
  'signatory.manage',
  'billing.invoice',
  'billing.payment',
  'billing.refund',
  'billing.discount.approve',
  'billing.close',
  'billing.manage',
  'revenue.view',
  'masters.manage',
  'home.book',
  'home.dispatch',
  'messaging.manage',
  'portal.doctor',
  'quality.record',
  'quality.manage',
  'document.author',
  'document.approve',
  'privacy.manage',
  'interface.manage',
  'autoverify.manage',
  'autoverify.approve',
  'insight.feedback',
  'data.export',
  'data.reset',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const BENCH: Permission[] = [
  'label.print',
  'consent.record',
  'specimen.collect',
  'specimen.receive',
  'specimen.reject',
  'specimen.process',
  'specimen.split',
  'specimen.send-out',
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
  'quality.record',
  'interface.manage',
  'document.author',
  'insight.feedback',
]

const SIGNATORY: Permission[] = [
  'consent.record',
  'result.comment',
  'result.verify',
  'result.authorise',
  'report.release',
  'report.share',
  'report.amend.request',
  'report.amend.authorise',
  'report.withdraw',
  'critical.communicate',
  'quality.record',
  'quality.manage',
  'document.author',
  'document.approve',
  'autoverify.manage',
  'autoverify.approve',
  'insight.feedback',
  'data.export',
]

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  receptionist: [
    'patient.register',
    'patient.edit',
    'patient.merge',
    'consent.record',
    'order.create',
    'order.cancel',
    'label.print',
    'report.share',
    'billing.invoice',
    'billing.payment',
    'billing.close',
    'masters.manage',
    'home.book',
    'insight.feedback',
  ],
  phlebotomist: [
    'label.print',
    'consent.record',
    'specimen.collect',
    'insight.feedback',
  ],
  technician: BENCH,
  // The lab manager also holds the administrator rights (catalog, settings,
  // reset), as a small laboratory has no separate administrator.
  'lab-manager': [
    ...BENCH,
    'order.cancel',
    'work.assign',
    'patient.merge',
    'catalog.edit',
    'settings.edit',
    'signatory.manage',
    'billing.invoice',
    'billing.payment',
    'billing.refund',
    'billing.discount.approve',
    'billing.close',
    'billing.manage',
    'revenue.view',
    'masters.manage',
    'home.book',
    'home.dispatch',
    'messaging.manage',
    'quality.manage',
    'document.approve',
    'privacy.manage',
    'autoverify.manage',
    'data.export',
    'data.reset',
  ],
  pathologist: SIGNATORY,
  microbiologist: SIGNATORY,
  owner: [
    'billing.invoice',
    'billing.payment',
    'billing.refund',
    'billing.discount.approve',
    'billing.close',
    'billing.manage',
    'revenue.view',
    'masters.manage',
    'messaging.manage',
    'settings.edit',
    'privacy.manage',
    'insight.feedback',
    'data.export',
  ],
  // Read-only: their own patients' released reports (enforced by the API).
  doctor: ['portal.doctor'],
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

/**
 * Whether a person is on the signatory registry for a department, active
 * and within the registration's validity: only they may authorise its
 * results (NABL 112A, Tamil Nadu rules: named signatories).
 */
export function isRegisteredSignatory(
  staff: Pick<Staff, 'signatory'>,
  department: DepartmentId,
  now: number,
) {
  const s = staff.signatory
  return Boolean(
    s &&
    s.active &&
    s.departments.includes(department) &&
    (s.validUntil === undefined || now <= s.validUntil),
  )
}
