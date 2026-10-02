import { ChevronRightIcon, InfoIcon, ScanLineIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/app/layout/page-header'
import { IMAGING_NAV } from '@/app/layout/nav-config'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { NAV_TONES } from '@/lib/icon-tones'
import type { ImagingRow } from '@/services/lab-api'
import { useImagingOverview } from '@/services/queries'
import { ImagingStatusBadge } from '@/components/lab/imaging-status'
import { PriorityMark } from '@/components/lab/status'
import { IconGlyph } from '@/components/ui/icon-tile'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { MODALITY_NAV, MODALITY_PATH } from './modality'

function StudyRow({ row }: { row: ImagingRow }) {
  const f = useFormat()
  const now = useNow()
  const e = useEnum()
  return (
    <li>
      <Link
        to={`/imaging/reports/${row.id}`}
        className="focus-ring clinical-row flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-meta font-medium text-fg">
            {row.examName}
          </span>
          <span className="block truncate text-xs text-fg-subtle">
            {row.patient.name} · {row.patient.uhid} ·{' '}
            {row.reportedAt
              ? f.dateTime(row.reportedAt)
              : row.performedAt
                ? f.relative(row.performedAt, now)
                : f.dateTime(row.scheduledAt)}
          </span>
        </span>
        {row.priority !== 'routine' ? (
          <PriorityMark priority={row.priority} />
        ) : (
          <span className="sr-only">{e('priority', row.priority)}</span>
        )}
        <ImagingStatusBadge status={row.status} />
        <ChevronRightIcon className="size-4 text-fg-subtle" aria-hidden />
      </Link>
    </li>
  )
}

/**
 * The Diagnostic Imaging dashboard: today's studies, what waits for a
 * report, and each modality's recent work.
 */
export function Component() {
  const t = useT('imaging')
  const tn = useT('nav')
  const { data, isPending, isError, refetch } = useImagingOverview()

  return (
    <>
      <PageHeader title={t('title')} meta={<span>{t('overviewMeta')}</span>} />
      <p className="mb-5 flex max-w-3xl items-start gap-2 rounded-lg border-l-2 border-l-info-text/50 bg-info-soft/50 px-3.5 py-2.5 text-meta text-fg-muted">
        <InfoIcon
          className="mt-0.5 size-4 shrink-0 text-info-text"
          aria-hidden
        />
        {t('readOnly')}
      </p>
      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-5">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid gap-5 lg:grid-cols-3">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <MetricStrip
            items={[
              { key: 'today', label: t('kpiToday'), value: data.counts.today },
              {
                key: 'awaiting',
                label: t('kpiAwaiting'),
                value: data.counts.awaitingReport,
                alert: data.counts.awaitingReport > 0,
              },
              {
                key: 'reported',
                label: t('kpiReported'),
                value: data.counts.reportedToday,
              },
              {
                key: 'scheduled',
                label: t('kpiScheduled'),
                value: data.counts.scheduled,
              },
              {
                key: 'amended',
                label: t('kpiAmended'),
                value: data.counts.amended,
              },
            ]}
          />

          <section
            aria-labelledby="imaging-awaiting"
            className="rounded-xl border border-line bg-surface"
          >
            <h2
              id="imaging-awaiting"
              className="border-b border-line px-4 py-2.5 text-sm font-semibold text-fg"
            >
              {t('awaitingTitle')}
            </h2>
            {data.awaiting.length ? (
              <ul className="divide-y divide-line">
                {data.awaiting.map((row) => (
                  <StudyRow key={row.id} row={row} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-meta text-fg-muted">
                {t('awaitingEmpty')}
              </p>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-3">
            {data.modalities.map((m) => {
              const nav = IMAGING_NAV.find(
                (n) => n.key === MODALITY_NAV[m.modality],
              )
              return (
                <section
                  key={m.modality}
                  aria-labelledby={`imaging-${m.modality}`}
                  className="flex min-w-0 flex-col rounded-xl border border-line bg-surface"
                >
                  <div className="flex items-start gap-3 border-b border-line px-4 py-3">
                    {nav ? (
                      <IconGlyph
                        icon={nav.icon}
                        tone={NAV_TONES[nav.key]}
                        size={22}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h2
                        id={`imaging-${m.modality}`}
                        className="text-sm font-semibold text-fg"
                      >
                        {tn(MODALITY_NAV[m.modality])}
                      </h2>
                      <p className="text-xs text-fg-subtle">
                        {t(`modalityLong.${m.modality}`)} ·{' '}
                        {t('totalStudies', { count: m.total })}
                      </p>
                    </div>
                    <dl className="flex gap-4 text-right">
                      <div>
                        <dt className="text-2xs text-fg-subtle">
                          {t('kpiAwaiting')}
                        </dt>
                        <dd className="text-base font-semibold text-fg tabular-nums">
                          {m.awaitingReport}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-2xs text-fg-subtle">
                          {t('kpiScheduled')}
                        </dt>
                        <dd className="text-base font-semibold text-fg tabular-nums">
                          {m.scheduled}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  {m.recent.length ? (
                    <ul className="flex-1 divide-y divide-line">
                      {m.recent.map((row) => (
                        <StudyRow key={row.id} row={row} />
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      icon={<ScanLineIcon />}
                      compact
                      title={t('emptyTitle')}
                    />
                  )}
                  <Link
                    to={MODALITY_PATH[m.modality]}
                    className="focus-ring flex min-h-11 items-center gap-1 border-t border-line px-4 text-meta font-semibold text-accent-text hover:underline"
                  >
                    {t('viewAll', { modality: tn(MODALITY_NAV[m.modality]) })}
                    <ChevronRightIcon className="size-4" aria-hidden />
                  </Link>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
