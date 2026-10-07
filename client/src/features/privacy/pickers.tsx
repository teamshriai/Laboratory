import { FileTextIcon, PencilIcon, UserSearchIcon } from 'lucide-react'
import { useDeferredValue, useState, type ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { usePatients, useReports } from '@/services/queries'
import { PatientCell } from '@/components/lab/patient'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'

export interface Picked {
  id: string
  label: ReactNode
}

function Chosen({
  picked,
  onChange,
}: {
  picked: Picked
  onChange: () => void
}) {
  const t = useT('privacy')
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-3">
      <div className="min-w-48 flex-1">{picked.label}</div>
      <Button size="sm" variant="secondary" onClick={onChange}>
        <PencilIcon />
        {t('change')}
      </Button>
    </div>
  )
}

function ResultList({
  enabled,
  invalid,
  hint,
  isError,
  isFetching,
  onRetry,
  items,
}: {
  enabled: boolean
  invalid: boolean
  hint: string
  isError: boolean
  isFetching: boolean
  onRetry: () => void
  items: { id: string; content: ReactNode; onPick: () => void }[]
}) {
  const t = useT('privacy')
  if (!enabled)
    return invalid ? null : <p className="text-xs text-fg-subtle">{hint}</p>
  if (isError) return <ErrorState compact onRetry={onRetry} />
  if (items.length === 0 && isFetching)
    return <Skeleton className="h-14 rounded-xl" />
  if (items.length === 0)
    return (
      <p className="flex items-center gap-2 text-meta text-fg-muted">
        <UserSearchIcon className="size-4 shrink-0" aria-hidden />
        {t('noMatches')}
      </p>
    )
  return (
    <ul className="grid max-h-64 gap-1.5 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={item.onPick}
            className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg border border-line p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/30"
          >
            {item.content}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Finds a patient by name, UHID or mobile. */
export function PatientPicker({
  value,
  onChange,
  invalid = false,
}: {
  value: Picked | null
  onChange: (picked: Picked | null) => void
  invalid?: boolean
}) {
  const t = useT('privacy')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const enabled = q.length >= 2
  const { data, isFetching, isError, refetch } = usePatients(
    enabled ? { q, pageSize: 8 } : { q: '__none__', pageSize: 1 },
  )
  if (value) return <Chosen picked={value} onChange={() => onChange(null)} />
  const rows = enabled ? (data?.rows ?? []) : []
  return (
    <div className="grid gap-2">
      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('patientSearchPlaceholder')}
        aria-label={t('patientSearch')}
        aria-invalid={invalid || undefined}
      />
      <ResultList
        enabled={enabled}
        invalid={invalid}
        hint={t('searchHint')}
        isError={isError}
        isFetching={isFetching}
        onRetry={() => void refetch()}
        items={rows.map((p) => {
          const content = (
            <PatientCell
              patient={p}
              link={false}
              size="sm"
              className="flex-1"
            />
          )
          return {
            id: p.id,
            content: (
              <>
                {content}
                <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
                  {p.mobile}
                </span>
              </>
            ),
            onPick: () => onChange({ id: p.id, label: content }),
          }
        })}
      />
    </div>
  )
}

/** Finds a report by report number or patient. */
export function ReportPicker({
  value,
  onChange,
  invalid = false,
}: {
  value: Picked | null
  onChange: (picked: Picked | null) => void
  invalid?: boolean
}) {
  const t = useT('privacy')
  const f = useFormat()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const enabled = q.length >= 2
  const { data, isFetching, isError, refetch } = useReports(
    enabled ? { q, pageSize: 8 } : { q: '__none__', pageSize: 1 },
  )
  if (value) return <Chosen picked={value} onChange={() => onChange(null)} />
  const rows = enabled ? (data?.rows ?? []) : []
  return (
    <div className="grid gap-2">
      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('reportSearchPlaceholder')}
        aria-label={t('reportSearch')}
        aria-invalid={invalid || undefined}
      />
      <ResultList
        enabled={enabled}
        invalid={invalid}
        hint={t('searchHint')}
        isError={isError}
        isFetching={isFetching}
        onRetry={() => void refetch()}
        items={rows.map((r) => {
          const content = (
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <FileTextIcon
                className="size-4 shrink-0 text-fg-subtle"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block font-mono text-meta font-semibold text-fg">
                  {r.reportNo}
                </span>
                <span className="block truncate text-xs text-fg-muted">
                  {r.patient.name} · {r.patient.uhid} ·{' '}
                  {f.date(r.releasedAt ?? r.createdAt)}
                </span>
              </span>
            </span>
          )
          return {
            id: r.id,
            content,
            onPick: () => onChange({ id: r.id, label: content }),
          }
        })}
      />
    </div>
  )
}
