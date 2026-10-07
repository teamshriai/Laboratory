// Rule-based suggestions (the insight card) and the auto-verification marks
// in the verification queue. Never a diagnosis: a person decides.
export default {
  title: 'Suggestions',
  subtitle: "Rule-based checks of this lab's own data. A person decides.",
  label: 'Automated suggestion: verify before acting',
  loadError: 'Suggestions could not be loaded.',
  emptyTitle: 'No suggestions right now',
  emptyBody: 'The rules found nothing unusual in the recent data.',
  // Statements
  'statement.rejection-rise':
    'Specimen rejections are at {rate}% over the last 7 days ({count} rejected), above the {target}% target.',
  'statement.qc-shift-high':
    '{analyte} {level} on {equipment}: the last 4 QC runs are all more than 1 SD above the mean.',
  'statement.qc-shift-low':
    '{analyte} {level} on {equipment}: the last 4 QC runs are all more than 1 SD below the mean.',
  'statement.tat-cluster':
    'Workload peaks between {from} and {to} ({share}% of the week), while {delayed}% of results ran past their TAT target.',
  'statement.cold-excursion_one':
    '{unit} went outside its {min} to {max} °C limits {count} time in the last 7 days (latest {value} °C).',
  'statement.cold-excursion_other':
    '{unit} went outside its {min} to {max} °C limits {count} times in the last 7 days (latest {value} °C).',
  // Evidence
  why: 'Why?',
  'why.rejected-count':
    '{recent} specimens rejected in the last 7 days, against {prior} in the 7 days before.',
  'why.collected-count_one': '{count} specimen collected in the last 7 days.',
  'why.collected-count_other':
    '{count} specimens collected in the last 7 days.',
  'why.qc-runs':
    'The last {count} runs of this control are all more than {sd} SD from the mean, on the same side.',
  'why.peak-share':
    "{share}% of the last 7 days' workload falls in this two-hour window.",
  'why.delayed-share':
    'On average {pct}% of results a day ran past their TAT target.',
  'why.readings_one':
    '{count} reading out of range; the latest around {at} IST.',
  'why.readings_other':
    '{count} readings out of range; the latest around {at} IST.',
  'why.other': 'A rule matched the recent data.',
  window: 'Data from {from} to {to}',
  rule: 'Rule: {version}',
  sources: 'Sources',
  'source.reception': 'Specimen reception',
  'source.quality-control': 'Quality control',
  'source.tat': 'Turnaround time',
  'source.cold-storage': 'Cold storage',
  'confidence.low': 'Low confidence',
  'confidence.medium': 'Medium confidence',
  'confidence.high': 'High confidence',
  // Feedback
  accept: 'Accept',
  dismiss: 'Dismiss',
  notUseful: 'Not useful',
  accepted: 'Accepted by you',
  acceptedToast: 'Suggestion accepted',
  dismissedToast: 'Suggestion dismissed',
  notUsefulToast:
    'Thank you. The suggestion is hidden and your reason is recorded.',
  notUsefulTitle: 'Why is this suggestion not useful?',
  notUsefulBody:
    'Your reason is recorded with the suggestion and its rule version, so the rules can be improved.',
  reasonLabel: 'Reason',
  reasonPlaceholder:
    'For example: the shift was already explained by a new lot',
  // Auto-verification marks in the verification queue
  'auto.passed': 'Auto-verification passed',
  'auto.held': 'Held: {checks}',
  'auto.heldLabel': 'Auto-verification held: {checks}',
  'auto.rule': 'Auto-verification rule v{version}',
  'auto.check.within-reference': 'outside reference interval',
  'auto.check.no-critical': 'critical value',
  'auto.check.no-delta-failure': 'delta check failed',
  'auto.check.no-instrument-flag': 'instrument flag',
  'auto.check.qc-passed': 'QC not passed',
  'auto.filter': 'Passed auto-verification',
  'auto.filterEmpty': 'No results in this list passed auto-verification.',
  'auto.authoriseAll': 'Authorise all that passed ({count})',
  'auto.confirmTitle_one':
    'Authorise {count} result that passed auto-verification?',
  'auto.confirmTitle_other':
    'Authorise {count} results that passed auto-verification?',
  'auto.confirmBody':
    'Each result passed every check of its auto-verification rule. The rule only marks them: you authorise them, they are signed in your name and the audit trail records it.',
  'auto.confirmAction': 'Authorise and sign',
  'auto.confirmList': 'Tests to authorise',
} as const
