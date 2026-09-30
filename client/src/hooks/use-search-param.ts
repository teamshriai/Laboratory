import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

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
