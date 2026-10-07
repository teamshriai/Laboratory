// Builds the laboratory API from the endpoint table: each method becomes a
// typed HTTP call. Nothing here knows about any one screen.

import type { LabApi } from '../contract'
import { request } from './client'
import { ENDPOINTS, type Endpoint } from './endpoints'

/** `/v1/orders/:id` + { id: 'ord 1' } -> `/v1/orders/ord%201`. */
export function fillPath(
  path: string,
  params: Record<string, string | number> = {},
) {
  return path.replace(/:(\w+)/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`Missing path parameter ${name}`)
    return encodeURIComponent(String(value))
  })
}

function call<A extends unknown[]>(endpoint: Endpoint<A>) {
  return (...args: A) => {
    const { params, query, body } = endpoint.map(...args)
    return request<unknown>({
      method: endpoint.method,
      path: fillPath(endpoint.path, params),
      ...(query ? { query } : {}),
      ...(body !== undefined ? { body } : {}),
    })
  }
}

export function createHttpLabApi(): LabApi {
  const api: Record<string, Record<string, unknown>> = {}
  for (const [ns, methods] of Object.entries(ENDPOINTS)) {
    api[ns] = Object.fromEntries(
      Object.entries(methods as Record<string, Endpoint<unknown[]>>).map(
        ([name, endpoint]) => [name, call(endpoint)],
      ),
    )
  }
  // The table is typed method by method against LabApi (endpoints.ts), and
  // each call returns the server's JSON for that method: the DTO.
  return api as unknown as LabApi
}
