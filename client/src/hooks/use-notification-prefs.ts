import type { NotificationType } from '@/domain/types'
import type { SummaryKey } from '@/services/lab-api'
import { usePersistentState } from './use-persistent-state'

export const ALERT_GROUPS = [
  'critical',
  'tat',
  'rejection',
  'inventory',
  'qc',
  'equipment',
  'reports',
] as const
export type AlertGroup = (typeof ALERT_GROUPS)[number]
export type NotificationPrefs = Record<AlertGroup, boolean>

const DEFAULTS: NotificationPrefs = {
  critical: true,
  tat: true,
  rejection: true,
  inventory: true,
  qc: true,
  equipment: true,
  reports: true,
}

const TYPE_GROUP: Record<NotificationType, AlertGroup> = {
  'critical-detected': 'critical',
  'critical-escalated': 'critical',
  'sample-rejected': 'rejection',
  'recollection-requested': 'rejection',
  'report-released': 'reports',
  'report-corrected': 'reports',
  'report-withdrawn': 'reports',
  'result-returned': 'reports',
  'qc-failed': 'qc',
  'equipment-down': 'equipment',
  'lot-quarantined': 'inventory',
}

const SUMMARY_GROUP: Record<SummaryKey, AlertGroup> = {
  'critical-pending': 'critical',
  'tat-approaching': 'tat',
  'lots-expiring': 'inventory',
  'recollection-pending': 'rejection',
}

/** Which alert types this browser shows in the notification panel. */
export function useNotificationPrefs() {
  const [prefs, setPrefs] = usePersistentState<NotificationPrefs>(
    'notification-prefs',
    DEFAULTS,
  )
  const merged = { ...DEFAULTS, ...prefs }
  return {
    prefs: merged,
    set: (group: AlertGroup, on: boolean) =>
      setPrefs((p) => ({ ...DEFAULTS, ...p, [group]: on })),
    showsType: (type: NotificationType) => merged[TYPE_GROUP[type]],
    showsSummary: (key: SummaryKey) => merged[SUMMARY_GROUP[key]],
  }
}
