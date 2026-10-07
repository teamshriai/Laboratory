import { RefreshCwIcon, BellRingIcon, FileTextIcon } from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useDeferredValue } from 'react'
import { useNavigate } from 'react-router'
import {
  DEPARTMENTS,
  REPORT_STATUSES,
  type DepartmentId,
  type ReportStatus,
} from '@/domain/types'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useTablePaging } from '@/hooks/use-table-paging'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import {
  labApi,
  type DatePreset,
  type ReportFilters,
  type ReportRow,
} from '@/services/lab-api'
import { useReports } from '@/services/queries'
import { ExportButton } from '@/components/lab/export-button'
import { FilterBar } from '@/components/lab/filter-bar'
import { RecordLink } from '@/components/lab/record-link'
import { PatientCell } from '@/components/lab/patient'
import { ReportStatusBadge } from '@/components/lab/status'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'

const DATES = ['today', 'yesterday', '7d', '30d', 'all'] as const

export function Component() {
  const t = useT('reports')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const navigate = useNavigate()
  const filters = useUrlFilters(
    { status: 'all', date: 'today', department: 'all', q: '' },
    {
      status: ['all', ...REPORT_STATUSES],
      date: DATES,
      department: ['all', ...DEPARTMENTS],
    },
  )
  const status = filters.values.status as ReportStatus | 'all'
  const date = filters.values.date as DatePreset
  const department = filters.values.department as DepartmentId | 'all'
  const query = filters.values.q
  const setQuery = (q: string) => filters.set({ q })
  const setDate = (d: DatePreset) => filters.set({ date: d })
  const setDepartment = (d: DepartmentId | 'all') =>
    filters.set({ department: d })
  const q = useDeferredValue(query)
  const paging = useTablePaging(25, ['report', 'patient', 'flags', 'released'])
  const listFilters: ReportFilters = {
    status,
    date,
    q,
    ...(department !== 'all' ? { department } : {}),
  }
  const { data, isPending, isError, refetch } = useReports({
    ...listFilters,
    ...paging.query,
  })

  const columns: Column<ReportRow>[] = [
    {
      id: 'report',
      header: t('colReport'),
      sortable: true,
      cell: (r) => (
        <div>
          <RecordLink
            kind="report"
            id={r.id}
            className="text-meta font-semibold whitespace-nowrap text-fg"
          >
            {r.reportNo}
          </RecordLink>
          <RecordLink
            kind="order"
            id={r.orderId}
            className="flex w-fit text-xs text-fg-subtle"
          >
            {r.orderNo}
          </RecordLink>
        </div>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      sortable: true,
      cell: (r) => <PatientCell patient={r.patient} showLocal={false} />,
    },
    {
      id: 'dept',
      header: t('colDepartment'),
      cell: (r) => (
        <div>
          <p className="text-meta text-fg">{e('department', r.department)}</p>
          <p className="max-w-52 truncate text-xs text-fg-muted">
            {r.tests.join(', ')}
          </p>
        </div>
      ),
    },
    {
      id: 'flags',
      header: t('colFlags'),
      sortable: true,
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.criticalCount ? (
            <Badge tone="solidDanger" size="sm">
              <BellRingIcon strokeWidth={2.2} />
              {t('critical', { count: r.criticalCount })}
            </Badge>
          ) : null}
          {r.abnormalCount ? (
            <span className="text-xs font-semibold text-warning-text">
              {t('abnormal', { count: r.abnormalCount })}
            </span>
          ) : null}
          {!r.criticalCount && !r.abnormalCount ? (
            <span className="text-xs text-fg-subtle">-</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'doctor',
      tabletHidden: true,
      header: t('colDoctor'),
      cell: (r) => <span className="text-meta text-fg">{r.doctorName}</span>,
    },
    {
      id: 'released',
      header: t('colReleased'),
      sortable: true,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap">
          {r.releasedAt ? f.dateTime(r.releasedAt) : '-'}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          <ReportStatusBadge status={r.status} size="sm" />
          {r.version > 1 ? (
            <span className="text-xs text-fg-muted">
              {t('version', { version: r.version })}
            </span>
          ) : null}
          {r.renotifyPending ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-text">
              <RefreshCwIcon className="size-3" aria-hidden />
              {t('renotify')}
            </span>
          ) : null}
        </div>
      ),
    },
  ]

  const setStatus = (v: ReportStatus | 'all') => filters.set({ status: v })

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          data ? (
            <span>{t('totalCount', { count: data.counts.all })}</span>
          ) : null
        }
        actions={
          <ExportButton
            filename={t('exportFile')}
            entity="report"
            disabled={!data?.rows.length}
            rows={async () => [
              [
                t('colReport'),
                t('colPatient'),
                tc('uhid'),
                t('colDepartment'),
                t('colTests'),
                t('colDoctor'),
                t('colStatus'),
                t('colReleased'),
                tc('orderNo'),
              ],
              // Every matching report, not just the page on screen.
              ...(await labApi.reports.list(listFilters)).rows.map((r) => [
                `${r.reportNo} v${r.version}`,
                r.patient.name,
                r.patient.uhid,
                e('department', r.department),
                r.tests.join('; '),
                r.doctorName,
                e('reportStatus', r.status),
                r.releasedAt ? f.dateTime(r.releasedAt) : '',
                r.orderNo,
              ]),
            ]}
          />
        }
      />
      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-1">
          <FilterTabs
            value={status}
            onValueChange={setStatus}
            items={[
              {
                value: 'all' as const,
                label: t('tabAll'),
                count: data?.counts.all,
              },
              ...REPORT_STATUSES.map((s) => ({
                value: s,
                label: e('reportStatus', s),
                count: data?.counts[s],
              })),
            ]}
          />
        </div>
        <FilterBar>
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('search')}
            aria-label={tc('search')}
            className="w-full sm:w-96"
          />
          <Select
            size="sm"
            className="w-36"
            aria-label={tc('date')}
            value={date}
            onValueChange={setDate}
            options={(['today', 'yesterday', '7d', '30d', 'all'] as const).map(
              (d) => ({ value: d, label: e('datePreset', d) }),
            )}
          />
          <Select
            size="sm"
            className="w-44"
            aria-label={tc('department')}
            value={department}
            onValueChange={setDepartment}
            options={[
              { value: 'all' as const, label: tc('all') },
              ...DEPARTMENTS.map((d) => ({
                value: d,
                label: e('department', d),
              })),
            ]}
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('title')}
            columns={columns}
            rows={data?.rows}
            server={paging.table(data?.page)}
            getRowId={(r) => r.id}
            rowLabel={(r) => r.reportNo}
            onRowClick={(r) => void navigate(`/reports/${r.id}`)}
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            minWidth={1000}
            empty={
              <EmptyState
                icon={<FileTextIcon />}
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
