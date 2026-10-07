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
  'duplicate-code': 'The code {code} is already in use.',
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
  network:
    'The laboratory server could not be reached. Check the connection and try again.',
  timeout: 'The server took too long to answer. Please try again.',
  unauthenticated: 'Your session has ended. Sign in again to continue.',
  conflict:
    'Someone else changed this record just now. Reload it to see the latest, then try again.',
  'rate-limited':
    'Too many requests in a short time. Wait a moment and try again.',
  'server-error':
    'The server could not complete that. Please try again; if it keeps happening, tell your administrator.',
  'identity-not-confirmed':
    'Confirm the patient with two identifiers (for example name and date of birth) before collecting.',
  'fasting-status-required':
    'Record whether the patient is fasting: a test on this specimen needs it.',
  'consent-required':
    "Record the patient's consent for {tests} before collecting.",
  'collection-scheduled':
    'This collection is due at {time}. Give a reason to collect it earlier.',
  'stability-exceeded':
    'The specimen is past its stability for {test}; collect a new one.',
  'not-a-signatory':
    '{name} is not on the signatory registry for {department}. Ask the lab manager to register them, or authorise as a registered signatory.',
  'calculated-value':
    'This value is calculated by the system and cannot be typed.',
  'invalid-pin': 'Enter a 6-digit PIN code that does not start with 0.',
  'invalid-abha':
    'Enter a 14-digit ABHA number, or an ABHA address such as name@abdm.',
  'invalid-mobile':
    'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.',
  'cannot-split':
    'This specimen cannot be split like that: choose tests not yet started, and keep at least one on the original.',
  'merge-same-patient': 'Choose two different patient records to merge.',
  'patient-merged':
    'This record was merged into another patient. Open the patient it was merged into.',
  'send-out-state':
    'This specimen cannot move to that send-out step. Check where it is now.',
  'link-not-found':
    'This link or code does not open a report. Check it, or ask the laboratory for a new one.',
  'link-expired':
    'This link has expired. Ask the laboratory to share the report again.',
  'link-revoked':
    'This link is no longer valid. The report may have been corrected; ask the laboratory for a new link.',
  'link-locked':
    'Too many wrong dates of birth. Try again in {minutes} minutes.',
  'dob-mismatch': 'That date of birth does not match. {left} attempts left.',
  'invoice-exists': 'This order already has an invoice. Open it instead.',
  'amount-invalid': 'Enter an amount above zero and no more than what is due.',
  'discount-pending':
    "A discount on this invoice is waiting for a manager's authorisation. Authorise or decline it first.",
  'reference-required': 'Enter the card slip or UPI transaction reference.',
  'over-credit-limit':
    'This would take {account} over its credit limit of {limit}.',
  'invoice-has-payments':
    'This invoice has payments. Refund them instead of cancelling or changing it.',
  'refund-too-large': 'A refund cannot be more than what was received.',
  'day-closed':
    "Today's cash is already closed. Ask the manager before taking more.",
  'slot-invalid':
    'Choose a visit time from now up to 30 days ahead, 15 minutes to 4 hours long.',
  'visit-state':
    'This visit cannot move to that step. Check its state and who it is assigned to.',
  'opted-out': 'The patient asked not to receive messages on this channel.',
  'independent-approval':
    'This needs sign-off by someone other than its author.',
  'legal-hold': 'A legal hold stops this: release the hold first.',
  'action-required': 'The reading is out of range: record the action taken.',
  'too-few-checks':
    'A verification run needs at least {min} released results to compare.',
  'assistant-off': 'The Lab Assistant is switched off in Settings.',
  'auditor-not-independent':
    'An auditor may not audit their own department; choose someone from another department.',
  'date-in-future': 'The date cannot be in the future.',
} as const
