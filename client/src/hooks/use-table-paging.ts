import { useSearchParams } from 'react-router'
import type { ServerPaging, TableSort } from '@/components/ui/data-table'

/**
 * Page and sort of a server-paged list, kept in the URL (`?page=2&sort=-patient`)
 * so a view can be linked and survives a reload. Only known sort keys are
 * accepted; a filter change (useUrlFilters) returns to the first page.
 */
export function useTablePaging(
  pageSize: number,
  sortable: readonly string[],
  defaultSort: TableSort | null = null,
) {
  const [params, setParams] = useSearchParams()
  const parsedPage = Number.parseInt(params.get('page') ?? '1', 10)
  const page =
    Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage - 1 : 0
  const rawSort = params.get('sort')
  const fromUrl = rawSort
    ? {
        id: rawSort.replace(/^-/, ''),
        desc: rawSort.startsWith('-'),
      }
    : null
  const sort = fromUrl && sortable.includes(fromUrl.id) ? fromUrl : defaultSort

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch))
          if (v === null) next.delete(k)
          else next.set(k, v)
        return next
      },
      { replace: true },
    )

  const query = {
    page,
    pageSize,
    ...(sort ? { sort: `${sort.desc ? '-' : ''}${sort.id}` } : {}),
  }

  /** The table's controls, given the page the server returned. */
  const table = (info?: { total: number; page: number }): ServerPaging => ({
    total: info?.total ?? 0,
    page: info?.page ?? page,
    pageSize,
    sort,
    onPageChange: (p) => update({ page: p > 0 ? String(p + 1) : null }),
    onSortChange: (s) =>
      update({
        page: null,
        sort: s ? `${s.desc ? '-' : ''}${s.id}` : null,
      }),
  })

  return { query, table }
}
