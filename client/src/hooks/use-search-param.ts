import { useCallback, useEffect } from 'react'
import {
  NavigationType,
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from 'react-router'

type Values = Record<string, string>

/**
 * A set of filters kept in the URL, so they survive refresh, can be shared
 * as a link and follow browser back/forward. A value equal to its default is
 * left out of the URL; an unknown value (hand-edited link) falls back to the
 * default. Filter changes replace the history entry rather than adding one.
 */
export function useUrlFilters<T extends Values>(
  defaults: T,
  allowed?: { [K in keyof T]?: readonly string[] },
) {
  const [params, setParams] = useSearchParams()
  const keys = Object.keys(defaults) as (keyof T & string)[]

  const values = { ...defaults }
  for (const k of keys) {
    const raw = params.get(k)
    const list = allowed?.[k]
    if (raw !== null && raw !== '' && (!list || list.includes(raw)))
      (values as Values)[k] = raw
  }

  const set = (patch: Partial<T>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        // A different set of rows starts on its first page.
        next.delete('page')
        for (const [k, v] of Object.entries(patch) as [
          string,
          string | undefined,
        ][]) {
          if (v === undefined || v === '' || v === defaults[k]) next.delete(k)
          else next.set(k, v)
        }
        return next
      },
      { replace: true },
    )

  const clear = (only?: (keyof T & string)[]) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('page')
        for (const k of only ?? keys) next.delete(k)
        return next
      },
      { replace: true },
    )

  const activeCount = (only?: (keyof T & string)[]) =>
    (only ?? keys).filter((k) => values[k] !== defaults[k]).length

  return { values, set, clear, activeCount }
}

/** One validated value in the URL (a tab, a section, a selected record). */
export function useSearchParam<V extends string>(
  key: string,
  fallback: V,
  allowed?: readonly V[],
) {
  const [params, setParams] = useSearchParams()
  const raw = params.get(key)
  const value =
    raw !== null && raw !== '' && (!allowed || allowed.includes(raw as V))
      ? (raw as V)
      : fallback
  const set = useCallback(
    (next: V | null, options?: { push?: boolean }) =>
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev)
          if (next === null || next === fallback) out.delete(key)
          else out.set(key, next)
          return out
        },
        { replace: !options?.push },
      ),
    [key, fallback, setParams],
  )
  return [value, set] as const
}

/** History entries (by location key) that opened an overlay with a push. */
const pushedOverlays = new Map<string, string>()

/**
 * A dialog or drawer opened from the URL (`?order=id`, `?nc=id`, `?new=1`).
 * Opening adds a history entry, so it can be linked and the phone's Back
 * button closes it. Closing goes back when this session opened it (by a
 * click, a link or `open`), and otherwise (a pasted link) removes the
 * parameter in place, so Back never reopens it or does nothing once.
 */
export function useOverlayParam(key: string) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const navigate = useNavigate()
  const raw = params.get(key)
  const value = raw === null || raw === '' ? null : raw
  useEffect(() => {
    if (value !== null && navigationType === NavigationType.Push)
      pushedOverlays.set(location.key, key)
  }, [value, navigationType, location.key, key])
  const open = useCallback(
    (id: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(key, id)
          return next
        },
        // Switching from one record to another keeps a single entry.
        { replace: params.has(key) },
      ),
    [key, params, setParams],
  )
  const close = useCallback(() => {
    if (pushedOverlays.get(location.key) === key) {
      pushedOverlays.delete(location.key)
      void navigate(-1)
      return
    }
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [key, location.key, navigate, setParams])
  return [value, open, close] as const
}
