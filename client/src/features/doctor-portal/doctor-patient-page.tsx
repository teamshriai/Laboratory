import {
  ActivityIcon,
  FileTextIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
  UserRoundXIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { isApiError } from '@/domain/errors'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam, useSearchParam } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { ReportRow } from '@/services/lab-api'
import { useDoctorPatient } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { AgeSex } from '@/components/lab/patient'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { DoctorOnlyNotice } from './doctor-only-notice'
import { FlagCounts } from './flag-counts'
import { ReportDrawer } from './report-drawer'
import { TrendChart } from './trend-chart'

/** Charts shown before "Show all": abnormal ones come first. */
const TRENDS_SHOWN = 6

export function Component() {
  const t = useT('doctorPortal')
  const f = useFormat()
  const now = useNow()
  const { patientId } = useParams()
  const { data, isPending, isError, error, refetch } =
    useDoctorPatient(patientId)
  const [reportId, openReportId, closeReport] = useOverlayParam('report')
  const [trendView, setTrendView] = useSearchParam('trends', 'flagged', [
    'flagged',
    'all',
  ] as const)

  const columns = useMemo<Column<ReportRow>[]>(
    () => [
      {
        id: 'report',
        header: t('colReport'),
        sortValue: (r) => r.reportNo,
        cell: (r) => (
          <div className="min-w-0">
            <p className="font-mono text-meta font-semibold whitespace-nowrap text-fg">
              {r.reportNo}
            </p>
            <p className="text-xs text-fg-muted">
              {t('version', { version: r.version })}
            </p>
          </div>
        ),
      },
      {
        id: 'tests',
        header: t('colTests'),
        cell: (r) => (
          <p
            className="max-w-64 truncate text-meta text-fg"
            title={r.tests.join(', ')}
          >
            {r.tests.slice(0, 3).join(', ')}
            {r.tests.length > 3 ? (
              <span className="text-fg-muted">
                {' '}
                {t('moreTests', { count: r.tests.length - 3 })}
              </span>
            ) : null}
          </p>
        ),
      },
      {
        id: 'released',
        header: t('colReleased'),
        sortValue: (r) => r.releasedAt ?? 0,
        cell: (r) =>
          r.releasedAt !== undefined ? (
            <span
              className="text-meta whitespace-nowrap text-fg tabular-nums"
              title={f.relative(r.releasedAt, now)}
            >
              {f.dateTime(r.releasedAt)}
            </span>
          ) : null,
      },
      {
        id: 'flags',
        header: t('colFlags'),
        sortValue: (r) => r.criticalCount * 100 + r.abnormalCount,
        cell: (r) => (
          <FlagCounts critical={r.criticalCount} abnormal={r.abnormalCount} />
        ),
      },
    ],
    [t, f, now],
  )

  const back = { to: '/my-patients', label: t('back') }

  if (isError) {
    const code = isApiError(error) ? error.code : null
    if (code === 'not-permitted')
      return (
        <>
          <PageHeader title={t('title')} back={back} />
          <DoctorOnlyNotice />
        </>
      )
    return (
      <>
        <PageHeader title={t('title')} back={back} />
        <Card>
          {code === 'not-found' ? (
            <EmptyState
              icon={<UserRoundXIcon />}
              tone="amber"
              title={t('notFoundTitle')}
              description={t('notFoundBody')}
              action={
                <Link
                  to="/my-patients"
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  {t('back')}
                </Link>
              }
            />
          ) : (
            <ErrorState onRetry={() => void refetch()} />
          )}
        </Card>
      </>
    )
  }

  if (isPending || !data)
    return (
      <div role="status" aria-busy className="grid gap-5">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <CardSkeleton lines={5} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    )

  const { patient, reports, trends, criticalAnalytes } = data
  const openReport = reports.find((r) => r.id === reportId)
  const shownTrends =
    trendView === 'all' ? trends : trends.slice(0, TRENDS_SHOWN)

  return (
    <>
      <PageHeader
        back={back}
        title={patient.name}
        titleExtra={
          patient.nameLocal ? (
            <span
              lang={patient.nameLocal.lang}
              className="text-sm text-fg-muted"
            >
              {patient.nameLocal.text}
            </span>
          ) : null
        }
        meta={
          <>
            <span className="font-mono text-fg tabular-nums">
              {patient.uhid}
            </span>
            <AgeSex dob={patient.dob} sex={patient.sex} />
            <span className="tabular-nums">
              {t('dob', { date: f.date(Date.parse(patient.dob)) })}
            </span>
            {patient.allergies.length ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-danger-soft px-2 py-0.5 font-semibold text-danger-text">
                <TriangleAlertIcon className="size-3.5" aria-hidden />
                {t('allergies', { list: patient.allergies.join(', ') })}
              </span>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5">
        {criticalAnalytes.length ? (
          <section
            aria-labelledby="critical-title"
            className="flex items-start gap-3 rounded-xl border border-danger-text/25 bg-danger-soft px-4 py-3.5 text-danger-text sm:px-5"
          >
            <OctagonAlertIcon
              strokeWidth={2.2}
              className="mt-0.5 size-5 shrink-0"
              aria-hidden
            />
            <div className="grid min-w-0 gap-2">
              <h2 id="critical-title" className="text-sm font-semibold">
                {t('criticalTitle')}
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {criticalAnalytes.map((name) => (
                  <li
                    key={name}
                    className="rounded-md border border-danger-text/25 bg-surface px-2 py-0.5 text-xs font-semibold"
                  >
                    {name}
                  </li>
                ))}
              </ul>
              <p className="text-meta">{t('criticalBody')}</p>
            </div>
          </section>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader
            icon={<FileTextIcon />}
            tone="blue"
            title={t('reportsTitle')}
            description={t('reportsHint')}
          />
          <div className="border-t border-line">
            <DataTable
              caption={t('reportsTitle')}
              columns={columns}
              rows={reports}
              getRowId={(r) => r.id}
              rowLabel={(r) => r.reportNo}
              onRowClick={(r) => openReportId(r.id)}
              activeRowId={reportId}
              rowClassName={(r) =>
                r.criticalCount > 0 ? 'row-alert' : undefined
              }
              mobile={{ primary: 'report', fields: ['released', 'flags'] }}
              pageSize={10}
              empty={
                <EmptyState
                  icon={<FileTextIcon />}
                  title={t('noReportsTitle')}
                  description={t('noReportsBody')}
                />
              }
            />
          </div>
        </Card>

        <section aria-labelledby="trends-title" className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <h2 id="trends-title" className="text-base font-semibold text-fg">
                {t('trendsTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-fg-subtle">{t('trendsHint')}</p>
            </div>
            {trends.length > TRENDS_SHOWN ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setTrendView(trendView === 'all' ? 'flagged' : 'all')
                }
              >
                {trendView === 'all'
                  ? t('showFewerTrends')
                  : t('showAllTrends', { count: trends.length })}
              </Button>
            ) : null}
          </div>
          {trends.length ? (
            <div className="@container">
              <div className="grid gap-4 @2xl:grid-cols-2 @6xl:grid-cols-3">
                {shownTrends.map((s) => (
                  <TrendChart key={s.analyteId} series={s} />
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <EmptyState
                compact
                icon={<ActivityIcon />}
                title={t('noTrendsTitle')}
                description={t('noTrendsBody')}
              />
            </Card>
          )}
        </section>
      </div>

      <ReportDrawer
        reportId={reportId}
        reportNo={openReport?.reportNo}
        onClose={closeReport}
      />
    </>
  )
}
