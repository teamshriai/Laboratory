import {
  ListTreeIcon,
  PencilIcon,
  PlusIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useDeferredValue } from 'react'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { CodeMappingRow, InterfaceOverview } from '@/services/lab-api'
import { FilterBar } from '@/components/lab/filter-bar'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import type { MappingDraft } from './interfaces'

const DEFAULTS = { analyser: 'all', q: '' }

/** Instrument test codes to the lab's analytes, per analyser, versioned. */
export function MappingsPanel({
  data,
  isPending,
  isError,
  onRetry,
  onEdit,
}: {
  data: InterfaceOverview | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  onEdit: (draft: MappingDraft) => void
}) {
  const t = useT('interfaces')
  const tc = useT('common')
  const f = useFormat()
  const analysers = data?.interfaces ?? []
  const url = useUrlFilters(DEFAULTS, {
    analyser: ['all', ...analysers.map((a) => a.equipmentId)],
  })
  const { analyser } = url.values
  const q = useDeferredValue(url.values.q).trim().toLowerCase()
  const filtered = url.activeCount() > 0
  const nameOf = (id: string) =>
    analysers.find((a) => a.equipmentId === id)?.name ?? id

  const rows = data?.mappings.filter(
    (m) =>
      (analyser === 'all' || m.equipmentId === analyser) &&
      (!q ||
        [m.instrumentCode, m.analyteName, nameOf(m.equipmentId)].some((v) =>
          v.toLowerCase().includes(q),
        )),
  )
  // Analytes the analyser measures that have no code yet.
  const gaps = analysers
    .filter((a) => analyser === 'all' || a.equipmentId === analyser)
    .filter((a) => a.unmapped.length > 0)
  const analyteId = (name: string) =>
    data?.coding.find((c) => c.name === name)?.analyteId

  const columns: Column<CodeMappingRow>[] = [
    {
      id: 'code',
      header: t('instrumentCode'),
      sortValue: (m) => m.instrumentCode,
      cell: (m) => (
        <span className="font-mono text-meta font-medium text-fg">
          {m.instrumentCode}
        </span>
      ),
    },
    {
      id: 'analyser',
      header: t('analyser'),
      sortValue: (m) => nameOf(m.equipmentId),
      cell: (m) => (
        <span className="block max-w-56 truncate text-meta text-fg">
          {nameOf(m.equipmentId)}
        </span>
      ),
    },
    {
      id: 'analyte',
      header: t('analyte'),
      sortValue: (m) => m.analyteName,
      cell: (m) => (
        <span className="text-meta font-medium text-fg">{m.analyteName}</span>
      ),
    },
    {
      id: 'version',
      header: t('version'),
      sortValue: (m) => m.version,
      cell: (m) => (
        <Badge tone={m.version > 1 ? 'info' : 'neutral'} size="sm">
          {t('versionValue', { version: m.version })}
        </Badge>
      ),
    },
    {
      id: 'updated',
      header: t('updated'),
      tabletHidden: true,
      sortValue: (m) => m.updatedAt,
      cell: (m) => (
        <div className="grid gap-0.5">
          <span className="text-meta whitespace-nowrap text-fg">
            {m.updatedByName}
          </span>
          <span className="text-xs whitespace-nowrap text-fg-muted tabular-nums">
            {f.dateTime(m.updatedAt)}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      cell: (m) => (
        <GuardedButton
          permission="interface.manage"
          size="xs"
          aria-label={t('changeNamed', { code: m.instrumentCode })}
          onClick={() => onEdit({ existing: m })}
        >
          <PencilIcon />
          {t('change')}
        </GuardedButton>
      ),
    },
  ]

  return (
    <div className="grid gap-4">
      {gaps.length ? (
        <Card className="p-4 sm:p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-warning-text">
            <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
            {t('gapsTitle')}
          </h2>
          <p className="mt-0.5 text-meta text-fg-muted">{t('gapsBody')}</p>
          <ul className="mt-3 grid gap-3">
            {gaps.map((a) => (
              <li key={a.equipmentId}>
                <p className="text-xs font-medium text-fg-muted">{a.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {a.unmapped.map((name) => {
                    const id = analyteId(name)
                    return (
                      <GuardedButton
                        key={name}
                        permission="interface.manage"
                        size="sm"
                        variant="secondary"
                        aria-label={t('mapNamed', {
                          analyte: name,
                          analyser: a.name,
                        })}
                        onClick={() =>
                          onEdit({
                            equipmentId: a.equipmentId,
                            ...(id ? { analyteId: id } : {}),
                          })
                        }
                      >
                        <PlusIcon />
                        {name}
                      </GuardedButton>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        <FilterBar canClear={filtered} onClear={() => url.clear()}>
          <SearchInput
            value={url.values.q}
            onValueChange={(v) => url.set({ q: v })}
            placeholder={t('searchMappings')}
            aria-label={tc('search')}
            clearLabel={t('clearSearch')}
            className="w-full sm:w-72"
          />
          <Select
            size="sm"
            aria-label={t('filterAnalyser')}
            value={analyser}
            onValueChange={(v) => url.set({ analyser: v })}
            options={[
              { value: 'all', label: t('allAnalysers') },
              ...analysers.map((a) => ({
                value: a.equipmentId,
                label: a.name,
              })),
            ]}
            className="w-full sm:w-56"
          />
          <GuardedButton
            permission="interface.manage"
            size="sm"
            variant="primary"
            className="sm:ml-auto"
            disabled={!data || analysers.length === 0}
            onClick={() =>
              onEdit(analyser === 'all' ? {} : { equipmentId: analyser })
            }
          >
            <PlusIcon strokeWidth={2.5} />
            {t('addMapping')}
          </GuardedButton>
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('tabMappings')}
            columns={columns}
            rows={rows}
            getRowId={(m) => m.id}
            isLoading={isPending}
            isError={isError}
            onRetry={onRetry}
            pageSize={50}
            initialSort={{ id: 'code' }}
            mobile={{
              primary: 'code',
              fields: ['analyte', 'analyser', 'version'],
              actions: 'actions',
            }}
            empty={
              <EmptyState
                icon={<ListTreeIcon />}
                tone="teal"
                title={
                  filtered ? t('mappingsEmptyFiltered') : t('mappingsEmpty')
                }
                description={
                  filtered
                    ? t('mappingsEmptyFilteredBody')
                    : t('mappingsEmptyBody')
                }
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={() => url.clear()}>
                      {tc('clearFilters')}
                    </Button>
                  ) : null
                }
              />
            }
          />
        </div>
      </Card>
    </div>
  )
}
