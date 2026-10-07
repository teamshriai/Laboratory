import { HourglassIcon, InfoIcon, SigmaIcon } from 'lucide-react'
import { useSearchParam } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { UncertaintyRow } from '@/services/lab-api'
import { useUncertainty } from '@/services/queries'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { formatFixed, formatSigned, formatUpTo } from './records-shared'
import { StatusText } from './records-ui'

/** IQC results needed before uncertainty is estimated. */
const MIN_RESULTS = 20

const rowId = (r: UncertaintyRow) =>
  `${r.equipmentId}|${r.analyteId}|${r.level}`

/** Measurement uncertainty from six months of IQC (ISO 15189 7.3.4). */
export function UncertaintyPanel() {
  const t = useT('qualityRecords')
  const f = useFormat()
  const [analyser, setAnalyser] = useSearchParam<string>('mu', '')
  const { data, isPending, isError, refetch } = useUncertainty()
  const analysers = [
    ...new Map(
      (data ?? []).map((r) => [r.equipmentId, r.equipmentName]),
    ).entries(),
  ].toSorted((a, b) => a[1].localeCompare(b[1]))
  const known = analysers.some(([id]) => id === analyser)
  const rows =
    analyser && known ? data?.filter((r) => r.equipmentId === analyser) : data
  const ready = rows?.filter((r) => r.uncertainty).length ?? 0
  const dash = <span className="text-meta text-fg-subtle">-</span>
  const num = (text: string, strong = false) => (
    <span
      className={
        strong
          ? 'text-meta font-semibold whitespace-nowrap text-fg tabular-nums'
          : 'text-meta whitespace-nowrap text-fg-muted tabular-nums'
      }
    >
      {text}
    </span>
  )

  const columns: Column<UncertaintyRow>[] = [
    {
      id: 'analyte',
      header: t('colAnalyte'),
      sortValue: (r) => r.analyteName,
      cell: (r) => (
        <div className="max-w-56 min-w-0">
          <p className="truncate text-meta font-medium text-fg">
            {r.analyteName}
          </p>
          {r.unit ? (
            <p className="text-xs whitespace-nowrap text-fg-muted">{r.unit}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'analyser',
      header: t('colAnalyser'),
      sortValue: (r) => r.equipmentName,
      cell: (r) => (
        <span className="block max-w-48 truncate text-meta text-fg-muted">
          {r.equipmentName}
        </span>
      ),
    },
    {
      id: 'level',
      header: t('colLevel'),
      sortValue: (r) => r.level,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {t('level', { n: r.level.slice(1) })}
        </span>
      ),
    },
    {
      id: 'n',
      header: t('colN'),
      align: 'right',
      sortValue: (r) => r.n,
      cell: (r) =>
        r.uncertainty
          ? num(f.number(r.n))
          : num(t('nOfMin', { n: r.n, min: MIN_RESULTS })),
    },
    {
      id: 'mean',
      header: t('colMean'),
      align: 'right',
      tabletHidden: true,
      cell: (r) =>
        r.uncertainty ? num(formatUpTo(f.locale, r.uncertainty.mean, 3)) : dash,
    },
    {
      id: 'sd',
      header: t('colSd'),
      align: 'right',
      tabletHidden: true,
      cell: (r) =>
        r.uncertainty ? num(formatUpTo(f.locale, r.uncertainty.sd, 3)) : dash,
    },
    {
      id: 'cv',
      header: t('colCv'),
      align: 'right',
      sortValue: (r) => r.uncertainty?.cv ?? null,
      cell: (r) =>
        r.uncertainty ? num(formatFixed(f.locale, r.uncertainty.cv, 2)) : dash,
    },
    {
      id: 'expanded',
      header: t('colExpanded'),
      align: 'right',
      sortValue: (r) => r.uncertainty?.expanded ?? null,
      cell: (r) =>
        r.uncertainty ? (
          num(formatFixed(f.locale, r.uncertainty.expanded, 2), true)
        ) : (
          <StatusText icon={<HourglassIcon />} tone="muted">
            {t('notEnoughData')}
          </StatusText>
        ),
    },
    {
      id: 'bias',
      header: t('colBias'),
      align: 'right',
      sortValue: (r) => r.eqaBiasPct,
      cell: (r) =>
        r.eqaBiasPct !== null ? (
          num(formatSigned(f.locale, r.eqaBiasPct))
        ) : (
          <span className="text-xs whitespace-nowrap text-fg-subtle">
            {t('noEqa')}
          </span>
        ),
    },
  ]

  return (
    <div className="grid gap-4">
      <Card className="p-4 sm:p-5">
        <div className="flex gap-3">
          <InfoIcon
            className="mt-0.5 size-5 shrink-0 text-info-text"
            aria-hidden
          />
          <div className="grid gap-1.5 text-sm text-fg-muted">
            <p className="font-medium text-fg">{t('muMethodTitle')}</p>
            <p>{t('muMethod', { min: MIN_RESULTS })}</p>
            <p>{t('muBias')}</p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="text-meta text-fg-muted">
            {rows
              ? t('muReady', { ready, total: rows.length })
              : t('uncertaintyTitle')}
          </p>
          <Select
            size="sm"
            aria-label={t('colAnalyser')}
            value={known ? analyser : 'all'}
            onValueChange={(v) => setAnalyser(v === 'all' ? null : v)}
            options={[
              { value: 'all', label: t('allAnalysers') },
              ...analysers.map(([id, name]) => ({ value: id, label: name })),
            ]}
            className="w-full sm:w-64"
          />
        </div>
        <DataTable
          caption={t('uncertaintyTitle')}
          columns={columns}
          rows={rows}
          getRowId={rowId}
          pageSize={50}
          isLoading={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          mobile={{
            primary: 'analyte',
            fields: ['analyser', 'level', 'expanded', 'bias'],
          }}
          empty={
            <EmptyState
              icon={<SigmaIcon />}
              tone="sky"
              title={t('noUncertainty')}
              description={t('noUncertaintyBody', { min: MIN_RESULTS })}
            />
          }
        />
      </Card>
    </div>
  )
}
