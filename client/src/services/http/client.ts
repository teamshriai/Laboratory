// A small, typed HTTP client for the laboratory API. Every request:
// - goes to `env.apiBaseUrl` with JSON in and out and the session cookie
//   (the server owns authentication; no token is ever stored here);
// - carries an `X-Request-Id`, and writes also carry an `Idempotency-Key`,
//   so a retried write is applied once;
// - can be cancelled (AbortSignal) and times out;
// - fails only with ApiError, whose code maps to `errors.<code>` in the
//   translations, exactly like the mock's errors.

import { ApiError, isErrorCode } from '@/domain/errors'
import { env } from '@/lib/env'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface HttpRequest {
  method: HttpMethod
  /** Path under the API base, e.g. `/v1/orders/ord_123`. */
  path: string
  query?: Record<string, unknown>
  body?: unknown
  signal?: AbortSignal
}

/** Problem details the server returns with an error status. */
interface ProblemBody {
  code?: unknown
  params?: unknown
  requestId?: unknown
}

const randomId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('')

const scalar = (value: unknown) =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean'
    ? String(value)
    : JSON.stringify(value)

/**
 * Serialises filters: arrays repeat the key, nested objects are JSON, and
 * empty values are left out.
 */
export function toQueryString(query: Record<string, unknown> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, scalar(v))
    } else {
      params.set(key, scalar(value))
    }
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

function statusCode(status: number) {
  if (status === 401) return 'unauthenticated' as const
  if (status === 403) return 'not-permitted' as const
  if (status === 404) return 'not-found' as const
  if (status === 409) return 'conflict' as const
  if (status === 422 || status === 400) return 'validation-failed' as const
  if (status === 429) return 'rate-limited' as const
  return 'server-error' as const
}

async function toApiError(response: Response) {
  let problem: ProblemBody = {}
  try {
    problem = (await response.json()) as ProblemBody
  } catch {
    // Not JSON (a proxy error page): fall back to the status.
  }
  const params =
    problem.params && typeof problem.params === 'object'
      ? Object.fromEntries(
          Object.entries(problem.params as Record<string, unknown>).filter(
            (entry): entry is [string, string | number] =>
              typeof entry[1] === 'string' || typeof entry[1] === 'number',
          ),
        )
      : {}
  const requestId =
    typeof problem.requestId === 'string'
      ? problem.requestId
      : (response.headers.get('X-Request-Id') ?? undefined)
  return new ApiError(
    isErrorCode(problem.code) ? problem.code : statusCode(response.status),
    params,
    { status: response.status, ...(requestId ? { requestId } : {}) },
  )
}

export async function request<T>({
  method,
  path,
  query,
  body,
  signal,
}: HttpRequest): Promise<T> {
  const timeout = AbortSignal.timeout(env.requestTimeoutMs)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-Id': randomId(),
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['Idempotency-Key'] = randomId()

  let response: Response
  try {
    response = await fetch(`${env.apiBaseUrl}${path}${toQueryString(query)}`, {
      method,
      headers,
      credentials: 'include',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(timeout.aborted ? 'timeout' : 'network')
  }
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
