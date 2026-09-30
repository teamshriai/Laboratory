export default {
  genericTitle: 'Something went wrong',
  drawerFailedTitle: 'This record could not be shown',
  drawerFailedBody:
    'The page behind it still works. Try again, or close this panel and open the record from its list.',
  genericBody: 'We could not complete that. Please try again.',
  loadTitle: 'We could not load this',
  loadBody: 'The information did not load. Check again in a moment.',
  notFoundTitle: 'Not found',
  notFoundBody:
    'We could not find what you were looking for. It may have been moved or removed.',
  pageNotFound: 'Page not found',
  pageNotFoundBody:
    'The page you opened does not exist in the laboratory module.',
  backToOverview: 'Back to overview',
  'not-found': 'The record could not be found.',
  'invalid-transition':
    'That action is no longer possible for this record. Refresh and try again.',
  'validation-failed': 'Some details are missing or not valid.',
  'order-empty': 'Select at least one test.',
  'test-inactive': '{test} is not available for ordering.',
  'duplicate-test': '{test} is already on this order.',
  'order-has-validated-results':
    'This order has validated results. Remove individual tests instead.',
  'item-already-validated': 'This test has already been validated.',
  'sample-not-collected': 'Sample {accession} has not been collected yet.',
  'sample-already-received': 'Sample {accession} was already received.',
  'sample-not-in-lab':
    'Sample {accession} must be received before results can be entered.',
  'results-incomplete': '{test}: {count} result(s) still empty.',
  'not-authorized-validator':
    '{name} cannot validate results. Choose a pathologist or microbiologist.',
  'report-not-validated':
    'All tests on report {report} must be validated first.',
  'report-not-released': 'Release the report first.',
  'critical-unacknowledged':
    'Acknowledge the critical value first ({count} pending).',
  'equipment-unavailable': '{equipment} is not available right now.',
  'duplicate-code': 'Test code {code} is already in use.',
  'insufficient-stock': 'Only {available} available.',
  'simulated-failure': 'The connection dropped (simulated). Please try again.',
  dataRefreshed:
    'The demo data was refreshed because it was saved by an older version of the app.',
  'storage-full':
    'Browser storage is full. Changes are kept only until you close this tab.',
  'not-authorized-reviewer':
    '{name} cannot review results. Technical review is done by laboratory technicians, managers or pathologists.',
  'not-authorized-releaser':
    '{name} cannot release reports. Only a pathologist or microbiologist can sign and release a report.',
  'self-review-not-allowed':
    'You entered this result, so another person must review it (lab policy in Settings).',
  'not-reviewed':
    '{test} has not had its technical review yet. Review it before authorising.',
  'sample-on-hold':
    'Sample {accession} is on hold. Resume it before continuing.',
  'reason-required': 'Give a reason for this action.',
  'readback-required':
    'Confirm the clinician read the value back before recording acknowledgement.',
  'analyzer-offline':
    '{name} is offline or in error. Choose another analyzer or bring it back online.',
  'qc-hold':
    'QC failed on {name} for {test}. Patient samples cannot run until a repeat QC passes.',
  'lot-not-usable': 'Lot {lot} is {state} and cannot be used for this.',
  'order-closed': 'This order is closed ({status}) and cannot be changed.',
  'amendment-pending':
    'A correction for this report is already awaiting authorisation.',
  'no-amendment-pending': 'There is no correction awaiting authorisation.',
} as const
