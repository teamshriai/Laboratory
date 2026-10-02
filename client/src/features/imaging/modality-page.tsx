import { ChevronRightIcon, ScanLineIcon } from 'lucide-react'
import { useDeferredValue } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { PageHeader } from '@/app/layout/page-header'
import { IMAGING_STATUSES, type ImagingStatus } from '@/domain/types'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { ImagingRow } from '@/services/lab-api'
import { useImagingList } from '@/services/queries'
import { FilterBar } from '@/components/lab/filter-bar'
import { ImagingStatusBadge } from '@/components/lab/imaging-status'
import { RecordLink } from '@/components/lab/record-link'
import { PatientCell } from '@/components/lab/patient'
import { PriorityMark } from '@/components/lab/status'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { MODALITY_NAV, modalityFromPath } from './modality'

const STATUS_FILTERS = ['all', ...IMAGING_STATUSES] as const

/** One modality's worklist: work still to report first, then the reports. */
export function Component() {
  const t = useT('imaging')
  const tn = useT('nav')
  const tc = useT('common')
  const f = useFormat()
  const navigate = useNavigate()
  const modality = modalityFromPath(useLocation().pathname)
  const url = useUrlFilters(
    { status: 'all', q: '' },
    { status: STATUS_FILTERS },
  )
  const q = useDeferredValue(url.values.q)
  const status = url.values.status as ImagingStatus | 'all'
  const { data, isPending, isError, refetch } = useImagingList({
    modality,
    q,
  })
  const rows = (data ?? []).filter(
    (r) => status === 'all' || r.status === status,
  )
  const count = (s: ImagingStatus) => data?.filter((r) => r.status === s).length

  const columns: Column<ImagingRow>[] = [
    {
      id: 'exam',
      header: t('colExam'),
      sortValue: (r) => r.examName,
      cell: (r) => (
        <div className="grid gap-0.5">
          <Link
            to={`/imaging/reports/${r.id}`}
            onClick={(ev) => ev.stopPropagation()}
            className="inline-flex min-h-[24px] items-center text-meta font-semibold text-fg hover:text-accent-text hover:underline"
          >
            {r.examName}
          </Link>
          <span className="text-xs text-fg-subtle">{r.bodyRegion}</span>
        </div>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      sortValue: (r) => r.patient.name,
      cell: (r) => <PatientCell patient={r.patient} showLocal={false} />,
    },
    {
      id: 'accession',
      header: t('colAccession'),
      tabletHidden: true,
      cell: (r) => (
        <div className="grid gap-0.5 font-mono text-xs">
          <span className="text-fg">{r.accessionNo}</span>
          {r.reportNo ? (
            <RecordLink kind="imaging" id={r.id} className="text-fg-subtle">
              {r.reportNo}
            </RecordLink>
          ) : null}
        </div>
      ),
    },
    {
      id: 'priority',
      header: t('colPriority'),
      cell: (r) => <PriorityMark priority={r.priority} />,
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (r) => <ImagingStatusBadge status={r.status} />,
    },
    {
      id: 'date',
      header: t('colDate'),
      sortValue: (r) => r.performedAt ?? r.scheduledAt,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap tabular-nums">
          {f.dateTime(r.performedAt ?? r.scheduledAt)}
        </span>
      ),
    },
    {
      id: 'reported',
      header: t('colReported'),
      tabletHidden: true,
      sortValue: (r) => r.reportedAt ?? 0,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap tabular-nums">
          {r.reportedAt ? f.dateTime(r.reportedAt) : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      align: 'right',
      cell: (r) => (
        <Link
          to={`/imaging/reports/${r.id}`}
          onClick={(ev) => ev.stopPropagation()}
          className={buttonVariants({ size: 'xs' })}
        >
          {tc('open')}
          <ChevronRightIcon />
        </Link>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={tn(MODALITY_NAV[modality])}
        meta={<span>{t(`modalityLong.${modality}`)}</span>}
      />
      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-1">
          <FilterTabs
            value={status}
            onValueChange={(v) => url.set({ status: v })}
            items={[
              {
                value: 'all' as const,
                label: t('allStatuses'),
                count: data?.length,
              },
              ...IMAGING_STATUSES.map((s) => ({
                value: s,
                label: t(`status.${s}`),
                count: count(s),
              })),
            ]}
          />
        </div>
        <FilterBar onClear={() => url.clear()} canClear={url.activeCount() > 0}>
          <SearchInput
            value={url.values.q}
            onValueChange={(v) => url.set({ q: v })}
            placeholder={t('search')}
            aria-label={tc('search')}
            className="w-full sm:w-96"
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={tn(MODALITY_NAV[modality])}
            columns={columns}
            rows={isPending ? undefined : rows}
            getRowId={(r) => r.id}
            rowLabel={(r) => `${r.examName}, ${r.patient.name}`}
            onRowClick={(r) => void navigate(`/imaging/reports/${r.id}`)}
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            mobile={{
              primary: 'exam',
              fields: ['patient', 'status', 'date'],
              actions: 'actions',
            }}
            empty={
              <EmptyState
                icon={<ScanLineIcon />}
                title={t('emptyTitle')}
                description={t('emptyBody')}
              />
            }
          />
        </div>
      </Card>
    </>
  )
}
