import { FileTextIcon, StethoscopeIcon, UsersIcon } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { isApiError } from '@/domain/errors'
import { useNow } from '@/hooks/use-now'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useTablePaging } from '@/hooks/use-table-paging'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { DoctorPatientRow } from '@/services/lab-api'
import { useDoctorPatients } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { PatientCell } from '@/components/lab/patient'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { DoctorOnlyNotice } from './doctor-only-notice'
import { FlagCounts } from './flag-counts'

const SORTS = ['patient', 'flags', 'latest'] as const

/**
 * The referring doctor's home: their own patients with released reports,
 * critical results first. The API decides who is listed; this page only
 * shows what comes back.
 */
export function Component() {
  const t = useT('doctorPortal')
  const tc = useT('common')
  const f = useFormat()
  const now = useNow()
  const navigate = useNavigate()
  const url = useUrlFilters({ q: '' })
  const query = url.values.q
  const q = useDeferredValue(query)
  const paging = useTablePaging(25, SORTS)
  const { data, isPending, isError, error, refetch } = useDoctorPatients({
    q,
    ...paging.query,
  })
  const refused = isError && isApiError(error) && error.code === 'not-permitted'

  const columns = useMemo<Column<DoctorPatientRow>[]>(
    () => [
      {
        id: 'patient',
        header: t('colPatient'),
        sortable: true,
        cell: (r) => <PatientCell patient={r.patient} link={false} />,
      },
      {
        id: 'reports',
        header: t('colReports'),
        align: 'right',
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 text-meta text-fg tabular-nums">
            <FileTextIcon className="size-3.5 text-fg-subtle" aria-hidden />
            {f.number(r.reportCount)}
          </span>
        ),
      },
      {
        id: 'flags',
        header: t('colFlags'),
        sortable: true,
        cell: (r) => (
          <FlagCounts
            critical={r.criticalCount}
            abnormal={r.abnormalCount}
            hasReports={r.reportCount > 0}
          />
        ),
      },
      {
        id: 'latest',
        header: t('colLatest'),
        sortable: true,
        cell: (r) =>
          r.latestReportAt !== undefined && r.latestReportId ? (
            <div className="grid justify-items-start">
              <span
                className="text-meta whitespace-nowrap text-fg tabular-nums"
                title={f.relative(r.latestReportAt, now)}
              >
                {f.dateTime(r.latestReportAt)}
              </span>
              <Link
                to={`/my-patients/${r.patient.id}?report=${r.latestReportId}`}
                onClick={(ev) => ev.stopPropagation()}
                className="tap-reach py-0.5 text-xs font-medium text-accent-text hover:underline hover:underline-offset-2"
              >
                {t('openLatest')}
              </Link>
            </div>
          ) : (
            <span className="text-xs text-fg-subtle">{t('noReportYet')}</span>
          ),
      },
    ],
    [t, f, now],
  )

  const searching = query.trim() !== ''

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          data ? (
            <>
              {data.doctorName ? (
                <span className="inline-flex items-center gap-1.5">
                  <StethoscopeIcon
                    className="size-3.5 text-accent-text"
                    aria-hidden
                  />
                  {t('referredBy', { name: data.doctorName })}
                </span>
              ) : null}
              <span>{t('patientCount', { count: data.page.total })}</span>
            </>
          ) : isPending ? (
            <Skeleton className="h-3 w-48" />
          ) : null
        }
      />
      {refused ? (
        <DoctorOnlyNotice />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <SearchInput
              value={query}
              onValueChange={(v) => url.set({ q: v })}
              placeholder={t('searchPlaceholder')}
              aria-label={tc('search')}
              className="w-full sm:w-96"
            />
          </div>
          <DataTable
            caption={t('title')}
            columns={columns}
            rows={data?.rows}
            server={paging.table(data?.page)}
            getRowId={(r) => r.patient.id}
            rowLabel={(r) => `${r.patient.name}, ${r.patient.uhid}`}
            onRowClick={(r) => void navigate(`/my-patients/${r.patient.id}`)}
            rowClassName={(r) =>
              r.criticalCount > 0 ? 'row-alert' : undefined
            }
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            mobile={{ primary: 'patient', fields: ['flags', 'latest'] }}
            empty={
              searching ? (
                <EmptyState
                  icon={<UsersIcon />}
                  title={t('emptySearchTitle')}
                  description={t('emptySearchBody')}
                  action={
                    <button
                      type="button"
                      className={buttonVariants({ variant: 'secondary' })}
                      onClick={() => url.set({ q: '' })}
                    >
                      {t('clearSearch')}
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<UsersIcon />}
                  title={t('emptyTitle')}
                  description={t('emptyBody')}
                />
              )
            }
          />
        </Card>
      )}
    </>
  )
}
