// Server-side paging and sorting for the long lists. A backend does the
// same in its query (ORDER BY ... LIMIT/OFFSET or a cursor); the screens
// only ever see one page plus the total.

import type { PageInfo, PageQuery } from './types'

export type Sorters<T> = Record<
  string,
  (row: T) => string | number | null | undefined
>

/** The largest page a client may ask for. */
export const MAX_PAGE_SIZE = 200

/** `patient` -> ascending by patient; `-patient` -> descending. */
export function parseSort(sort: string | undefined) {
  if (!sort) return null
  const desc = sort.startsWith('-')
  return { key: desc ? sort.slice(1) : sort, desc }
}

/**
 * Sorts by a known key (unknown keys keep the list's own order) and returns
 * the requested page. Without `pageSize` the whole list comes back: the
 * demo's CSV export uses that; a backend streams exports instead.
 */
export function paginate<T>(
  rows: T[],
  query: PageQuery,
  sorters: Sorters<T>,
): { rows: T[]; page: PageInfo } {
  const sort = parseSort(query.sort)
  const by = sort ? sorters[sort.key] : undefined
  const ordered = by
    ? rows.toSorted((a, b) => {
        const va = by(a)
        const vb = by(b)
        if (va === vb) return 0
        if (va === null || va === undefined) return 1
        if (vb === null || vb === undefined) return -1
        const cmp =
          typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb))
        return sort?.desc ? -cmp : cmp
      })
    : rows
  const total = ordered.length
  if (query.pageSize === undefined)
    return { rows: ordered, page: { total, page: 0, pageSize: total } }
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(query.pageSize)),
  )
  const last = Math.max(0, Math.ceil(total / pageSize) - 1)
  const page = Math.min(last, Math.max(0, Math.floor(query.page ?? 0)))
  return {
    rows: ordered.slice(page * pageSize, page * pageSize + pageSize),
    page: { total, page, pageSize },
  }
}
