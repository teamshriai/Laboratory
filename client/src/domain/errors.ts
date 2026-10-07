// Errors every data source reports the same way: the in-browser mock throws
// them from its engine, and the HTTP adapter turns server responses into
// them. Each code maps to `errors.<code>` in the translations.

export const ERROR_CODES = [
  'not-found',
  'invalid-transition',
  'validation-failed',
  'order-empty',
  'test-inactive',
  'duplicate-test',
  'order-has-validated-results',
  'item-already-validated',
  'sample-not-collected',
  'sample-already-received',
  'sample-not-in-lab',
  'results-incomplete',
  'not-authorized-validator',
  'report-not-validated',
  'report-not-released',
  'critical-unacknowledged',
  'equipment-unavailable',
  'duplicate-code',
  'insufficient-stock',
  'simulated-failure',
  'storage-full',
  'not-authorized-reviewer',
  'not-authorized-releaser',
  'self-review-not-allowed',
  'not-reviewed',
  'sample-on-hold',
  'reason-required',
  'readback-required',
  'analyzer-offline',
  'qc-hold',
  'lot-not-usable',
  'order-closed',
  'amendment-pending',
  'no-amendment-pending',
  'not-permitted',
  'outside-discipline',
  'possible-duplicate',
  'implausible-value',
  'not-numeric',
  'order-in-lab',
  'test-resulted',
  'not-yet-collected',
  'nothing-authorised',
  'report-withdrawn',
  'collection-in-future',
  'collection-before-order',
  'collection-time-reason',
  'received-before-collected',
  'recipient-full-name',
  'identity-not-confirmed',
  'fasting-status-required',
  'consent-required',
  'collection-scheduled',
  'stability-exceeded',
  'not-a-signatory',
  'calculated-value',
  'invalid-pin',
  'invalid-abha',
  'invalid-mobile',
  'cannot-split',
  'merge-same-patient',
  'patient-merged',
  'send-out-state',
  'link-not-found',
  'link-expired',
  'link-revoked',
  'link-locked',
  'dob-mismatch',
  'invoice-exists',
  'amount-invalid',
  'discount-pending',
  'reference-required',
  'over-credit-limit',
  'invoice-has-payments',
  'refund-too-large',
  'day-closed',
  'slot-invalid',
  'visit-state',
  'opted-out',
  'independent-approval',
  'legal-hold',
  'action-required',
  'too-few-checks',
  'assistant-off',
  'auditor-not-independent',
  'date-in-future',
  // Transport: raised by the HTTP adapter, never by the rules.
  'network',
  'timeout',
  'unauthenticated',
  'conflict',
  'rate-limited',
  'server-error',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

const CODES = new Set<string>(ERROR_CODES)
export const isErrorCode = (code: unknown): code is ErrorCode =>
  typeof code === 'string' && CODES.has(code)

/** Codes a retry cannot fix: the request itself is wrong or not allowed. */
export const FINAL_CODES = new Set<ErrorCode>([
  'not-found',
  'not-permitted',
  'validation-failed',
  'invalid-transition',
  'unauthenticated',
  'conflict',
])

export class ApiError extends Error {
  code: ErrorCode
  params: Record<string, string | number>
  /** HTTP status, when the error came from the server. */
  status?: number
  /** The server's request id, to quote to support. */
  requestId?: string

  constructor(
    code: ErrorCode,
    params: Record<string, string | number> = {},
    meta: { status?: number; requestId?: string } = {},
  ) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.params = params
    if (meta.status !== undefined) this.status = meta.status
    if (meta.requestId !== undefined) this.requestId = meta.requestId
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
