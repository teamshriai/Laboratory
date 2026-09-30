import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
} from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useFormat } from '@/i18n/format'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Button } from './button'
import { TableSkeleton } from './skeleton'
import { ErrorState } from './states'
import { Checkbox } from './toggles'

export interface Column<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number | null | undefined
  align?: 'left' | 'right' | 'center'
  className?: string
  headerClassName?: string
  /**
   * Keep this column visible while scrolling horizontally. The first column
   * (the row's identity) is sticky unless this is `false`.
   */
  sticky?: boolean
  /** Leave this column out of the phone layout entirely. */
  mobileHidden?: boolean
  /**
   * Secondary detail dropped on tablets and laptops (768-1535px, where the
   * content area is at most about 1220px), so the table fits without
   * scrolling. The drawer or detail page still shows it.
   */
  tabletHidden?: boolean
}

/**
 * Phone layout (below md): each row becomes a stacked record. `primary` is the
 * row title, `fields` show as label/value pairs, `actions` sits on the right,
 * and remaining columns go into an expandable detail.
 */
export interface MobileLayout {
  primary: string
  fields?: string[]
  actions?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  empty: ReactNode
  pageSize?: number
  initialSort?: { id: string; desc?: boolean }
  selection?: {
    selected: Set<string>
    onChange: (next: Set<string>) => void
    isSelectable?: (row: T) => boolean
  }
  rowClassName?: (row: T) => string | undefined
  caption: string
  minWidth?: number
  maxHeight?: string
  className?: string
  /** Highlight a row (e.g. the one open in a drawer). */
  activeRowId?: string | null
  /** Phone layout; defaults to the first column plus the next two. */
  mobile?: MobileLayout | false
  /**
   * Names the row for its open button (screen readers, keyboard), e.g. the
   * accession number. Used with `onRowClick`.
   */
  rowLabel?: (row: T) => string
}

/**
 * The row actions stay pinned to the right edge, so the primary action is
 * always in view when a wide table scrolls sideways.
 */
const PIN_END =
  'sticky right-0 shadow-[inset_1px_0_0_var(--line)] group-data-[more-end]/scroll:shadow-[inset_1px_0_0_var(--line),-8px_0_12px_-10px_var(--edge-shade)]'

/** The identity column stays at the left edge, with a shadow once scrolled. */
const PIN_START =
  'sticky z-[2] group-data-[scrolled]/scroll:shadow-[inset_-1px_0_0_var(--line),8px_0_12px_-10px_var(--edge-shade)]'

/**
 * Marks the scroll container while content is hidden past either edge, so
 * the pinned columns can show a shadow. Written to the DOM directly: it
 * changes on every scroll frame and needs no re-render.
 */
function trackScrollEdges(el: HTMLDivElement | null) {
  if (!el) return
  const update = () => {
    const max = el.scrollWidth - el.clientWidth
    el.toggleAttribute('data-scrolled', el.scrollLeft > 1)
    el.toggleAttribute('data-more-end', el.scrollLeft < max - 1)
  }
  update()
  el.addEventListener('scroll', update, { passive: true })
  const observer = new ResizeObserver(update)
  observer.observe(el)
  return () => {
    el.removeEventListener('scroll', update)
    observer.disconnect()
  }
}

function isActionColumn<T>(col: Column<T>) {
  return col.id === 'actions'
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  isLoading,
  isError,
  onRetry,
  empty,
  pageSize = 20,
  initialSort,
  selection,
  rowClassName,
  caption,
  minWidth = 720,
  maxHeight,
  className,
  activeRowId,
  mobile,
  rowLabel,
}: DataTableProps<T>) {
  const t = useT('common')
  const f = useFormat()
  const [sort, setSort] = useState(initialSort ?? null)
  // The page resets whenever the number of rows changes (new filter or search).
  const [paging, setPaging] = useState({ page: 0, total: rows?.length ?? 0 })
  const page = paging.total === (rows?.length ?? 0) ? paging.page : 0
  const setPage = (p: number) =>
    setPaging({ page: p, total: rows?.length ?? 0 })

  if (isLoading && !rows)
    return <TableSkeleton columns={Math.min(columns.length, 7)} />
  if (isError && !rows) return <ErrorState onRetry={onRetry} compact />
  if (!rows || rows.length === 0) return <>{empty}</>

  const sortColumn = sort ? columns.find((c) => c.id === sort.id) : undefined
  const sorted = sortColumn?.sortValue
    ? rows.toSorted((a, b) => {
        const va = sortColumn.sortValue!(a)
        const vb = sortColumn.sortValue!(b)
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

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const visible = sorted.slice(
    current * pageSize,
    current * pageSize + pageSize,
  )

  const selectable = selection
    ? visible.filter((r) => selection.isSelectable?.(r) ?? true)
    : []
  const allSelected =
    selection &&
    selectable.length > 0 &&
    selectable.every((r) => selection.selected.has(getRowId(r)))
  const someSelected =
    selection && selectable.some((r) => selection.selected.has(getRowId(r)))

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return
    setSort((prev) =>
      prev?.id === col.id
        ? prev.desc
          ? null
          : { id: col.id, desc: true }
        : { id: col.id },
    )
  }

  // A clickable row opens with the mouse anywhere on it; for the keyboard and
  // screen readers it has a real, named button (visually hidden, the row
  // shows the focus ring), so rows never need a tabindex of their own and
  // links inside cells stay valid.
  const openButton = (row: T) =>
    onRowClick ? (
      <button
        type="button"
        data-row-open=""
        className="sr-only"
        aria-label={
          rowLabel ? t('openRow', { name: rowLabel(row) }) : t('open')
        }
        onClick={(e) => {
          e.stopPropagation()
          onRowClick(row)
        }}
      />
    ) : null
  const isStart = (col: Column<T>, i: number) =>
    i === 0 ? col.sticky !== false : Boolean(col.sticky)

  const alignClass = (a: Column<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'

  const layout: MobileLayout | null =
    mobile === false
      ? null
      : (mobile ?? {
          primary: columns[0]!.id,
          fields: columns
            .slice(1)
            .filter((c) => c.id !== 'actions' && !c.mobileHidden)
            .slice(0, 2)
            .map((c) => c.id),
          ...(columns.some((c) => c.id === 'actions')
            ? { actions: 'actions' }
            : {}),
        })
  const byId = new Map(columns.map((c) => [c.id, c]))
  const primary = layout ? byId.get(layout.primary) : undefined
  const fields = (layout?.fields ?? [])
    .map((id) => byId.get(id))
    .filter((c): c is Column<T> => Boolean(c))
  const actions = layout?.actions ? byId.get(layout.actions) : undefined
  const shown = new Set([
    layout?.primary,
    ...(layout?.fields ?? []),
    layout?.actions,
  ])
  const rest = columns.filter((c) => !shown.has(c.id) && !c.mobileHidden)

  return (
    <div className={className}>
      {layout && primary ? (
        <ul className="divide-y divide-line md:hidden" aria-label={caption}>
          {visible.map((row) => {
            const id = getRowId(row)
            const isSelected = selection?.selected.has(id)
            return (
              <li
                key={id}
                className={cn(
                  'px-4 py-3',
                  (isSelected || activeRowId === id) && 'bg-primary-50',
                  rowClassName?.(row),
                )}
              >
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  {selection && (selection.isSelectable?.(row) ?? true) ? (
                    <Checkbox
                      checked={Boolean(isSelected)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selection.selected)
                        if (checked) next.add(id)
                        else next.delete(id)
                        selection.onChange(next)
                      }}
                      label={t('selectRow')}
                      className="mt-0.5"
                    />
                  ) : null}
                  <div
                    className={cn(
                      'min-w-40 flex-1 rounded-lg has-[[data-row-open]:focus-visible]:outline-2 has-[[data-row-open]:focus-visible]:outline-offset-4 has-[[data-row-open]:focus-visible]:outline-focus',
                      onRowClick && 'cursor-pointer',
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {openButton(row)}
                    <div className="min-w-0">{primary.cell(row)}</div>
                    {fields.length ? (
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {fields.map((c) => (
                          <div key={c.id} className="min-w-0">
                            <dt className="text-2xs text-fg-subtle">
                              {c.header}
                            </dt>
                            <dd className="mt-0.5 min-w-0 text-meta break-words [&_.whitespace-nowrap]:whitespace-normal">
                              {c.cell(row)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                  {actions ? (
                    <div className="ml-auto shrink-0">{actions.cell(row)}</div>
                  ) : null}
                </div>
                {rest.length ? (
                  <details className="group/details mt-2">
                    <summary className="tap-reach inline-flex cursor-pointer list-none items-center gap-1 rounded-lg py-1 text-xs font-medium text-fg-muted hover:text-fg">
                      <ChevronDownIcon
                        className="size-3 transition-transform group-open/details:rotate-180"
                        aria-hidden
                      />
                      {t('moreDetails')}
                    </summary>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {rest.map((c) => (
                        <div key={c.id} className="min-w-0">
                          <dt className="text-2xs text-fg-subtle">
                            {c.header}
                          </dt>
                          <dd className="mt-0.5 min-w-0 text-meta break-words [&_.whitespace-nowrap]:whitespace-normal">
                            {c.cell(row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      <div
        ref={trackScrollEdges}
        className={cn(
          'group/scroll isolate scrollbar-thin overflow-auto',
          layout && primary && 'max-md:hidden',
        )}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {/* The minimum width applies on wide screens only: below 1536px
            columns size to their content, with secondary ones hidden. */}
        <table
          className="w-full border-separate border-spacing-0 text-sm min-[96rem]:min-w-(--table-min)"
          style={{ '--table-min': `${minWidth}px` } as CSSProperties}
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selection ? (
                <th
                  scope="col"
                  className="sticky top-0 left-0 z-30 w-10 min-w-10 border-b border-line bg-surface-2 py-2.5 pl-4 sm:pl-5"
                >
                  <Checkbox
                    checked={
                      allSelected
                        ? true
                        : someSelected
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={(checked) => {
                      const next = new Set(selection.selected)
                      for (const r of selectable) {
                        if (checked) next.add(getRowId(r))
                        else next.delete(getRowId(r))
                      }
                      selection.onChange(next)
                    }}
                    label={t('selected_other', { count: selectable.length })}
                  />
                </th>
              ) : null}
              {columns.map((col, i) => (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={
                    sort?.id === col.id
                      ? sort.desc
                        ? 'descending'
                        : 'ascending'
                      : undefined
                  }
                  className={cn(
                    'sticky top-0 z-10 h-10 border-b border-line bg-surface-2 px-2 text-xs font-semibold whitespace-nowrap text-fg-muted 2xl:px-2.5',
                    i === 0 && !selection && 'pl-4 sm:pl-5',
                    i === columns.length - 1 && 'pr-4 sm:pr-5',
                    isStart(col, i) &&
                      cn(PIN_START, 'z-20', selection ? 'left-10' : 'left-0'),
                    isActionColumn(col) && cn(PIN_END, 'z-20'),
                    col.tabletHidden && 'max-[96rem]:hidden',
                    alignClass(col.align),
                    col.headerClassName,
                  )}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className={cn(
                        '-my-1 inline-flex min-h-6 items-center gap-1 rounded py-1 hover:text-fg',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                      aria-label={t('sortBy', {
                        column:
                          typeof col.header === 'string' ? col.header : col.id,
                      })}
                    >
                      {col.header}
                      {sort?.id === col.id ? (
                        sort.desc ? (
                          <ChevronDownIcon
                            className="size-3"
                            strokeWidth={2.5}
                          />
                        ) : (
                          <ChevronUpIcon className="size-3" strokeWidth={2.5} />
                        )
                      ) : (
                        <ChevronsUpDownIcon className="size-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const id = getRowId(row)
              const isSelected = selection?.selected.has(id)
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'group transition-colors',
                    onRowClick &&
                      'cursor-pointer hover:bg-surface-2 has-[[data-row-open]:focus-visible]:bg-surface-2 has-[[data-row-open]:focus-visible]:outline-2 has-[[data-row-open]:focus-visible]:-outline-offset-2 has-[[data-row-open]:focus-visible]:outline-focus',
                    (isSelected || activeRowId === id) &&
                      'bg-primary-50 hover:bg-primary-50',
                    rowClassName?.(row),
                  )}
                >
                  {selection ? (
                    <td
                      className={cn(
                        'pinned-cell sticky left-0 z-[2] w-10 min-w-10 border-b border-line bg-surface py-2.5 pl-4 group-hover:bg-surface-2 sm:pl-5',
                        (isSelected || activeRowId === id) &&
                          'bg-primary-50 group-hover:bg-primary-50',
                      )}
                    >
                      {(selection.isSelectable?.(row) ?? true) ? (
                        <Checkbox
                          checked={Boolean(isSelected)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selection.selected)
                            if (checked) next.add(id)
                            else next.delete(id)
                            selection.onChange(next)
                          }}
                          label={t('selectRow')}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  {columns.map((col, i) => (
                    <td
                      key={col.id}
                      className={cn(
                        'clinical-row border-b border-line px-2 py-2.5 align-middle 2xl:px-2.5',
                        i === 0 && !selection && 'pl-4 sm:pl-5',
                        i === columns.length - 1 && 'pr-4 sm:pr-5',
                        isActionColumn(col) &&
                          cn(
                            PIN_END,
                            'pinned-cell z-[1] bg-surface group-hover:bg-surface-2',
                            (isSelected || activeRowId === id) &&
                              'bg-primary-50 group-hover:bg-primary-50',
                          ),
                        isStart(col, i) &&
                          cn(
                            PIN_START,
                            selection ? 'left-10' : 'left-0',
                            'pinned-cell bg-surface group-hover:bg-surface-2',
                            (isSelected || activeRowId === id) &&
                              'bg-primary-50 group-hover:bg-primary-50',
                          ),
                        col.tabletHidden && 'max-[96rem]:hidden',
                        alignClass(col.align),
                        col.className,
                      )}
                    >
                      {i === 0 ? openButton(row) : null}
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-2 text-xs text-fg-subtle">
          <span>
            {t('showing', {
              from: f.number(current * pageSize + 1),
              to: f.number(Math.min(sorted.length, (current + 1) * pageSize)),
              total: f.number(sorted.length),
            })}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="mr-1.5">
              {t('page', { page: current + 1, pages })}
            </span>
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label={t('previousPage')}
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label={t('nextPage')}
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
