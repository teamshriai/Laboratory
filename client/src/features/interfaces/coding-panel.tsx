import { BookOpenCheckIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { useDeferredValue } from 'react'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { CodingRow, InterfaceOverview } from '@/services/lab-api'
import { FilterBar } from '@/components/lab/filter-bar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { MetricStrip } from '@/components/ui/metric-strip'
import { KpiSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { Segmented } from '@/components/ui/toggles'
import { CODING_FILTERS, percentOf, type CodingFilter } from './interfaces'

const DEFAULTS = { show: 'all', q: '' }

function Missing() {
  const t = useT('interfaces')
  return (
    <span className="inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap text-warning-text">
      <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden />
      {t('missing')}
    </span>
  )
}

/** LOINC and UCUM coverage of the analytes the lab reports. */
export function CodingPanel({
  data,
  isPending,
  isError,
  onRetry,
}: {
  data: InterfaceOverview | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('interfaces')
  const tc = useT('common')
  const f = useFormat()
  const url = useUrlFilters(DEFAULTS, { show: CODING_FILTERS })
  const show = url.values.show as CodingFilter
  const q = useDeferredValue(url.values.q).trim().toLowerCase()
  const filtered = url.activeCount() > 0
  const rows = data?.coding.filter(
    (c) =>
      (show === 'all' ||
        (show === 'missing-loinc' && !c.loinc) ||
        (show === 'missing-ucum' && !c.ucum)) &&
      (!q ||
        [c.name, c.unit, c.loinc ?? '', ...c.testNames].some((v) =>
          v.toLowerCase().includes(q),
        )),
  )
  const coverage = data?.coverage

  const columns: Column<CodingRow>[] = [
    {
      id: 'analyte',
      header: t('analyte'),
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="max-w-72 min-w-0">
          <p className="text-meta font-medium text-fg">{c.name}</p>
          <p className="truncate text-xs text-fg-muted">
            {c.testNames.join(', ')}
          </p>
        </div>
      ),
    },
    {
      id: 'unit',
      header: tc('unit'),
      sortValue: (c) => c.unit,
      cell: (c) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {c.unit || '-'}
        </span>
      ),
    },
    {
      id: 'loinc',
      header: t('loinc'),
      sortValue: (c) => c.loinc ?? '',
      cell: (c) =>
        c.loinc ? (
          <span className="font-mono text-meta text-fg">{c.loinc}</span>
        ) : (
          <Missing />
        ),
    },
    {
      id: 'ucum',
      header: t('ucum'),
      sortValue: (c) => c.ucum ?? '',
      cell: (c) =>
        c.ucum ? (
          <span className="font-mono text-meta text-fg">{c.ucum}</span>
        ) : (
          <Missing />
        ),
    },
  ]

  return (
    <div className="grid gap-4">
      {coverage ? (
        <MetricStrip
          items={[
            {
              key: 'analytes',
              label: t('kpiAnalytes'),
              value: f.number(coverage.analytes),
            },
            {
              key: 'loinc',
              label: t('kpiLoinc'),
              value: `${percentOf(coverage.loinc, coverage.analytes)}%`,
              detail: t('countOf', {
                count: coverage.loinc,
                total: coverage.analytes,
              }),
            },
            {
              key: 'ucum',
              label: t('kpiUcum'),
              value: `${percentOf(coverage.ucum, coverage.analytes)}%`,
              detail: t('countOf', {
                count: coverage.ucum,
                total: coverage.analytes,
              }),
            },
            {
              key: 'missing',
              label: t('kpiMissingLoinc'),
              value: f.number(coverage.analytes - coverage.loinc),
              alert: coverage.loinc < coverage.analytes,
            },
          ]}
        />
      ) : isPending ? (
        <KpiSkeleton />
      ) : null}
      <div
        role="note"
        className="flex items-start gap-3 rounded-xl border border-info-text/25 bg-info-soft px-4 py-3 text-meta text-info-text"
      >
        <InfoIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">{t('loincReviewTitle')}</p>
          <p className="mt-0.5">{t('loincReviewBody')}</p>
        </div>
      </div>
      <Card className="overflow-hidden">
        <FilterBar canClear={filtered} onClear={() => url.clear()}>
          <SearchInput
            value={url.values.q}
            onValueChange={(v) => url.set({ q: v })}
            placeholder={t('searchCoding')}
            aria-label={tc('search')}
            clearLabel={t('clearSearch')}
            className="w-full sm:w-72"
          />
          <Segmented
            size="sm"
            aria-label={t('filterCoding')}
            value={show}
            onValueChange={(v) => url.set({ show: v })}
            options={CODING_FILTERS.map((v) => ({
              value: v,
              label: t(`coding.${v}`),
            }))}
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('tabCoding')}
            columns={columns}
            rows={rows}
            getRowId={(c) => c.analyteId}
            rowClassName={(c) =>
              !c.loinc || !c.ucum ? 'row-alert' : undefined
            }
            isLoading={isPending}
            isError={isError}
            onRetry={onRetry}
            pageSize={50}
            initialSort={{ id: 'analyte' }}
            mobile={{ primary: 'analyte', fields: ['unit', 'loinc', 'ucum'] }}
            empty={
              <EmptyState
                icon={<BookOpenCheckIcon />}
                tone="teal"
                title={filtered ? t('codingEmptyFiltered') : t('codingEmpty')}
                description={
                  filtered ? t('codingEmptyFilteredBody') : t('codingEmptyBody')
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
