// The HTTP contract stays complete and consistent with the mock: every
// method the screens can call has exactly one endpoint, and every path
// parameter is filled.

import { describe, expect, it, vi } from 'vitest'
import { labApi as mockApi } from '@/mock/api'
import { ApiError } from '@/domain/errors'
import { ENDPOINTS } from './endpoints'
import { fillPath } from './lab-api.http'
import { request, toQueryString } from './client'

const DEMO_ONLY = new Set(['system.reset', 'system.stats'])

const methodsOf = (api: object) =>
  Object.entries(api).flatMap(([ns, methods]) =>
    Object.keys(methods as object).map((m) => `${ns}.${m}`),
  )

describe('the HTTP contract', () => {
  it('has an endpoint for every method the mock serves, and no others', () => {
    const served = methodsOf(mockApi).filter((m) => !DEMO_ONLY.has(m))
    expect(methodsOf(ENDPOINTS).toSorted()).toEqual(served.toSorted())
  })

  it('gives each endpoint a unique method and path', () => {
    const seen = new Map<string, string>()
    for (const [ns, methods] of Object.entries(ENDPOINTS))
      for (const [name, ep] of Object.entries(
        methods as Record<string, { method: string; path: string }>,
      )) {
        const key = `${ep.method} ${ep.path}`
        expect(seen.get(key), `${ns}.${name} repeats ${key}`).toBeUndefined()
        seen.set(key, `${ns}.${name}`)
        expect(ep.path.startsWith('/v1/')).toBe(true)
      }
  })

  it('fills and encodes path parameters, and refuses a missing one', () => {
    expect(fillPath('/v1/orders/:id', { id: 'ord 1/2' })).toBe(
      '/v1/orders/ord%201%2F2',
    )
    expect(() => fillPath('/v1/orders/:id')).toThrow(/id/)
  })

  it('serialises filters and leaves out empty values', () => {
    expect(
      toQueryString({ q: 'raj', status: 'all', empty: '', ids: ['a', 'b'] }),
    ).toBe('?q=raj&status=all&ids=a&ids=b')
    expect(toQueryString({ range: { from: '2026-10-01' } })).toBe(
      `?range=${encodeURIComponent('{"from":"2026-10-01"}')}`,
    )
    expect(toQueryString({})).toBe('')
  })
})

describe('the HTTP client', () => {
  it('turns a problem response into a translated error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'not-permitted',
              params: { name: 'A', role: 'phlebotomist', action: 'x' },
              requestId: 'req_1',
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )
    const failure = request({ method: 'POST', path: '/v1/x', body: {} })
    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({
      code: 'not-permitted',
      status: 403,
      requestId: 'req_1',
    })
    vi.unstubAllGlobals()
  })

  it('falls back to the status when the body is not a problem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('Bad gateway', { status: 502 })),
      ),
    )
    await expect(
      request({ method: 'GET', path: '/v1/x' }),
    ).rejects.toMatchObject({ code: 'server-error', status: 502 })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 401 }))),
    )
    await expect(
      request({ method: 'GET', path: '/v1/x' }),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
    vi.unstubAllGlobals()
  })

  it('sends an idempotency key on writes only', async () => {
    const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(new Response('{}', { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    await request({ method: 'GET', path: '/v1/x' })
    await request({ method: 'POST', path: '/v1/x', body: { a: 1 } })
    const headers = fetchMock.mock.calls.map(
      ([, init]) => init.headers as Record<string, string>,
    )
    expect(headers[0]?.['Idempotency-Key']).toBeUndefined()
    expect(headers[1]?.['Idempotency-Key']).toMatch(/\w{8}/)
    expect(headers[1]?.['X-Request-Id']).toMatch(/\w{8}/)
    vi.unstubAllGlobals()
  })

  it('reports a network failure as such', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )
    await expect(
      request({ method: 'GET', path: '/v1/x' }),
    ).rejects.toMatchObject({ code: 'network' })
    vi.unstubAllGlobals()
  })
})
