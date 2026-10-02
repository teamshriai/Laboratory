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
  backToOverview: 'Back to dashboard',
  'not-found': 'The record could not be found.',
  'invalid-transition':
    'That action is no longer possible for this record. Refresh and try again.',
  'validation-failed': 'Some details are missing or not valid.',
  'order-empty': 'Select at least one test.',
  'test-inactive': '{test} is not available for ordering.',
  'duplicate-test': '{test} is already on this order.',
  'order-has-validated-results':
    'This order has authorised results. Remove individual tests instead.',
  'item-already-validated': 'This test has already been authorised.',
  'sample-not-collected': 'Specimen {accession} has not been collected yet.',
  'sample-already-received': 'Specimen {accession} was already received.',
  'sample-not-in-lab':
    'Specimen {accession} must be received before results can be entered.',
  'results-incomplete': '{test}: {count} result(s) still empty.',
  'not-authorized-validator':
    '{name} cannot authorise results. Choose a pathologist or microbiologist.',
  'report-not-validated':
    'All tests on report {report} must be authorised first.',
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
    'Specimen {accession} is on hold. Resume it before continuing.',
  'reason-required': 'Give a reason for this action.',
  'readback-required':
    'Confirm the clinician read the value back before recording acknowledgement.',
  'analyzer-offline':
    '{name} is offline or in error. Choose another analyzer or bring it back online.',
  'qc-hold':
    'QC failed on {name} for {test}. Patient specimens cannot run until a repeat QC passes.',
  'lot-not-usable': 'Lot {lot} is {state} and cannot be used for this.',
  'order-closed': 'This order is closed ({status}) and cannot be changed.',
  'amendment-pending':
    'A correction for this report is already awaiting authorisation.',
  'no-amendment-pending': 'There is no correction awaiting authorisation.',
  'not-permitted':
    '{name} ({role}) cannot {action}. Switch "Acting as" to: {roles}.',
  'outside-discipline':
    '{name} authorises {department} results only. Ask a pathologist to authorise {test}.',
  'possible-duplicate':
    'A patient with the same name, date of birth and sex already exists ({uhid}). Open that record, or register anyway with a reason.',
  'implausible-value':
    '{analyte} {value} {unit} is outside the possible range ({low} - {high}). Check the value and the unit.',
  'not-numeric': '{analyte} needs a number, for example 4.2, <0.5 or >1000.',
  'order-in-lab':
    'Specimen {accession} is already in the laboratory. Cancel individual tests instead.',
  'test-resulted':
    '{test} already has a result. Correct the result instead of cancelling the test.',
  'nothing-authorised':
    'Authorise at least one test before releasing a preliminary report.',
  'report-withdrawn': 'Report {report} was withdrawn and cannot be changed.',
  'collection-in-future': 'Collection time cannot be later than now ({now}).',
  'collection-before-order':
    'Collection time cannot be before the order was placed ({time}).',
  'collection-time-reason':
    'Say why the collection time is more than 10 minutes ago.',
  'received-before-collected':
    'This specimen was collected at {time}. It cannot be received before that.',
  'recipient-full-name':
    'Record the full name of the person you reached, for example "Dr. Asha Kiran". A first name alone is not enough.',
} as const
