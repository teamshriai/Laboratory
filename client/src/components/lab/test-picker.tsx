import { CheckIcon, DropletIcon, SearchIcon } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { DEPARTMENTS } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { OrderableTest } from '@/services/lab-api'
import { DEPARTMENT_ICONS } from '@/app/layout/nav-config'
import { SearchInput } from '../ui/input'
import { EmptyState } from '../ui/states'
import { ContainerChip } from './sample'

/** Searchable test catalog grouped by department, with toggle selection. */
export function TestPicker({
  tests,
  selected,
  onToggle,
  disabledIds = [],
  className,
  maxHeight = '28rem',
}: {
  tests: OrderableTest[]
  selected: string[]
  onToggle: (testId: string) => void
  disabledIds?: string[]
  className?: string
  maxHeight?: string
}) {
  const t = useT('orders')
  const e = useEnum()
  const f = useFormat()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim().toLowerCase())
  const groups = useMemo(() => {
    const match = (x: OrderableTest) =>
      !q ||
      [x.name, x.shortName, x.code, ...x.keywords, ...x.analyteNames].some(
        (v) => v.toLowerCase().includes(q),
      )
    return DEPARTMENTS.map((d) => ({
      department: d,
      tests: tests.filter((x) => x.department === d && match(x)),
    })).filter((g) => g.tests.length > 0)
  }, [tests, q])
  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('testSearchPlaceholder')}
        aria-label={t('testSearch')}
        autoFocus
      />
      <div
        className="-mx-1 min-h-0 scrollbar-thin overflow-y-auto px-1"
        style={{ maxHeight }}
      >
        {groups.length === 0 ? (
          <EmptyState compact icon={<SearchIcon />} title={t('noTests')} />
        ) : (
          groups.map((g) => (
            <section key={g.department} className="mb-4 last:mb-0">
              <h3 className="sticky top-0 z-[1] mb-1.5 flex items-center gap-2 bg-surface py-1 text-xs font-semibold text-fg-muted [&_svg]:size-3.5">
                {DEPARTMENT_ICONS[g.department]}
                {e('department', g.department)}
                <span className="font-normal text-fg-subtle">
                  {g.tests.length}
                </span>
              </h3>
              <ul className="grid gap-1.5">
                {g.tests.map((test) => {
                  const on = selected.includes(test.id)
                  const disabled = disabledIds.includes(test.id)
                  const matched =
                    q &&
                    !test.name.toLowerCase().includes(q) &&
                    !test.shortName.toLowerCase().includes(q)
                      ? test.analyteNames.find((a) =>
                          a.toLowerCase().includes(q),
                        )
                      : undefined
                  return (
                    <li key={test.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-pressed={on}
                        onClick={() => onToggle(test.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-[border-color,background-color] disabled:opacity-45',
                          on
                            ? 'border-accent/50 bg-accent-soft/50'
                            : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-md border',
                            on
                              ? 'border-accent bg-accent text-on-accent'
                              : 'border-line-strong bg-surface',
                          )}
                        >
                          {on ? (
                            <CheckIcon strokeWidth={2.5} className="size-3" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="truncate text-sm font-medium text-fg">
                              {test.name}
                            </span>
                            <span className="shrink-0 font-mono text-2xs text-fg-subtle">
                              {test.code}
                            </span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                            <ContainerChip
                              container={test.container}
                              className="text-xs text-fg-muted"
                            />
                            <span>
                              {t('analytes', {
                                count: test.analyteNames.length,
                              })}
                            </span>
                            <span>{f.hours(test.tatHours)}</span>
                            {test.fasting ? (
                              <span className="inline-flex items-center gap-1 text-warning-text">
                                <DropletIcon className="size-3" />
                                {t('fastingRequired')}
                              </span>
                            ) : null}
                            {matched ? (
                              <span className="text-accent-text">
                                {matched}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-fg tabular-nums">
                          {f.currency(test.price)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
