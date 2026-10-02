export default {
  title: 'Notifications',
  markAllRead: 'Mark all as read',
  empty: 'You are all caught up',
  emptyBody: 'New alerts from the laboratory will appear here.',
  needsAttention: 'Needs attention',
  recent: 'Recent',
  'summary.critical-pending_one':
    '{count} critical result awaiting acknowledgement',
  'summary.critical-pending_other':
    '{count} critical results awaiting acknowledgement',
  'summary.tat-approaching_one': '{count} test near or over its TAT target',
  'summary.tat-approaching_other':
    '{count} tests near or over their TAT target',
  'summary.lots-expiring_one': '{count} reagent lot expiring within 30 days',
  'summary.lots-expiring_other': '{count} reagent lots expiring within 30 days',
  'summary.recollection-pending_one':
    '{count} rejected specimen awaiting recollection',
  'summary.recollection-pending_other':
    '{count} rejected specimens awaiting recollection',
  'critical-detected': 'Critical value for {patient}: {analyte} {value}',
  'critical-escalated': 'Critical {analyte} for {patient} escalated to {to}',
  'sample-rejected': 'Specimen {accession} for {patient} was rejected',
  'recollection-requested': 'Recollection requested for {patient}',
  'report-released': 'Report {report} released for {patient}',
  'report-corrected':
    'Report {report} for {patient} amended (version {version})',
  'report-withdrawn': 'Report {report} for {patient} was withdrawn',
  'qc-failed': 'QC failed on {equipment}: {analyte} {level} ({rule})',
  'equipment-down': '{equipment} is out of service',
  'lot-quarantined': 'Reagent lot {lot} ({item}) quarantined',
  'result-returned': '{test} for {patient} was sent back: {reason}',
} as const
