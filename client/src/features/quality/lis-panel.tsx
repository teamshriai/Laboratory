import {
  CalendarClockIcon,
  DatabaseIcon,
  HourglassIcon,
  InfoIcon,
  PlayIcon,
  TriangleAlertIcon,
  UserCheckIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { addMonths } from '@/domain/quality'
import { DAY } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type LisVerificationRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useLisVerifications } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { LisDrawer } from './records-lis-drawer'
import { NotFoundDrawer } from '@/features/shared/not-found-drawer'
import { DUE_SOON_DAYS, LIS_PARAM } from './records-shared'
import { OutcomeBadge, StatusText, TextDialog } from './records-ui'

/** Months between LIS verification runs (NABL 112A 7.6.3). */
const LIS_INTERVAL_MONTHS = 6

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-1 grid justify-items-start gap-1 text-sm font-medium text-fg">
        {children}
      </dd>
    </div>
  )
}

/** LIS verification: analyser, LIS and report values compared. */
export function LisPanel() {
  const t = useT('qualityRecords')
  const f = useFormat()
  const now = useNow()
  const [openId, setOpenId, closeOpen] = useOverlayParam(LIS_PARAM)
  const [running, setRunning] = useState(false)
  const { data, isPending, isError, refetch } = useLisVerifications()
  const run = useLabMutation(
    (note: string) =>
      labApi.quality.runLisVerification(note ? note : undefined),
    {
      success: () => t('lisRunDone'),
      onSuccess: (id) => {
        setRunning(false)
        setOpenId(id)
      },
    },
  )
  const open = openId ? data?.find((r) => r.id === openId) : undefined
  // Rows arrive newest first.
  const last = data?.[0]
  const nextDue = last
    ? addMonths(last.performedAt, LIS_INTERVAL_MONTHS)
    : undefined
  const awaiting = data?.filter((r) => !r.reviewedAt).length ?? 0

  const columns: Column<LisVerificationRow>[] = [
    {
      id: 'run',
      header: t('colRun'),
      sortValue: (r) => r.performedAt,
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-mono text-meta font-semibold whitespace-nowrap text-fg">
            {r.runNo}
          </p>
          <p className="text-xs whitespace-nowrap text-fg-muted">
            {f.dateTime(r.performedAt)}
          </p>
        </div>
      ),
    },
    {
      id: 'checks',
      header: t('specimensCompared'),
      align: 'right',
      sortValue: (r) => r.checks.length,
      cell: (r) => {
        const matched = r.checks.filter((c) => c.match).length
        return (
          <span className="text-meta whitespace-nowrap text-fg tabular-nums">
            {t('matchedOf', { matched, total: r.checks.length })}
          </span>
        )
      },
    },
    {
      id: 'outcome',
      header: t('colOutcome'),
      sortValue: (r) => r.outcome,
      cell: (r) => <OutcomeBadge outcome={r.outcome} />,
    },
    {
      id: 'performedBy',
      header: t('performedBy'),
      sortValue: (r) => r.performedByName,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {r.performedByName}
        </span>
      ),
    },
    {
      id: 'review',
      header: t('reviewedBy'),
      cell: (r) =>
        r.reviewedAt && r.reviewedByName ? (
          <span className="grid gap-0.5">
            <StatusText icon={<UserCheckIcon />} tone="success">
              {r.reviewedByName}
            </StatusText>
            <span className="text-xs whitespace-nowrap text-fg-muted">
              {f.date(r.reviewedAt)}
            </span>
          </span>
        ) : (
          <StatusText icon={<HourglassIcon />} tone="warning">
            {t('awaitingReview')}
          </StatusText>
        ),
    },
  ]

  return (
    <div className="grid gap-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {isPending ? (
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : isError ? (
            <p className="flex-1 text-sm text-fg-muted">{t('lisLoadError')}</p>
          ) : (
            <dl className="grid flex-1 grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
              <Fact label={t('lastVerified')}>
                {last ? (
                  <>
                    <span className="tabular-nums">
                      {f.date(last.performedAt)}
                    </span>
                    <OutcomeBadge outcome={last.outcome} />
                  </>
                ) : (
                  <StatusText icon={<TriangleAlertIcon />} tone="danger">
                    {t('neverVerified')}
                  </StatusText>
                )}
              </Fact>
              <Fact label={t('nextDue')}>
                {nextDue !== undefined ? (
                  <>
                    <span className="tabular-nums">{f.date(nextDue)}</span>
                    {nextDue < now ? (
                      <StatusText icon={<TriangleAlertIcon />} tone="danger">
                        {t('verificationOverdue')}
                      </StatusText>
                    ) : nextDue - now <= DUE_SOON_DAYS * DAY ? (
                      <StatusText icon={<CalendarClockIcon />} tone="warning">
                        {t('dueSoon')}
                      </StatusText>
                    ) : (
                      <span className="text-xs font-normal text-fg-muted">
                        {t('everySixMonths')}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-fg-muted">{t('dueNow')}</span>
                )}
              </Fact>
              <Fact label={t('awaitingReview')}>
                <span className="tabular-nums">{f.number(awaiting)}</span>
              </Fact>
            </dl>
          )}
          <GuardedButton
            permission="quality.record"
            variant="primary"
            onClick={() => setRunning(true)}
          >
            <PlayIcon />
            {t('runVerification')}
          </GuardedButton>
        </div>
        <div className="mt-4 grid gap-2 border-t border-line pt-4 text-meta text-fg-muted">
          <p>{t('lisRule')}</p>
          <p className="flex gap-2">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-info-text"
              aria-hidden
            />
            {t('simulatedNote')}
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <DataTable
          caption={t('lisRunsTitle')}
          columns={columns}
          rows={data}
          getRowId={(r) => r.id}
          rowLabel={(r) => r.runNo}
          onRowClick={(r) => setOpenId(r.id)}
          activeRowId={open?.id ?? null}
          rowClassName={(r) => (r.outcome === 'fail' ? 'row-alert' : undefined)}
          initialSort={{ id: 'run', desc: true }}
          pageSize={25}
          isLoading={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          mobile={{
            primary: 'run',
            fields: ['checks', 'outcome', 'review'],
          }}
          empty={
            <EmptyState
              icon={<DatabaseIcon />}
              tone="teal"
              title={t('noRuns')}
              description={t('noRunsBody')}
            />
          }
        />
      </Card>

      {open ? (
        <LisDrawer run={open} onClose={closeOpen} />
      ) : openId && data ? (
        <NotFoundDrawer
          title={t('colRun')}
          heading={t('lisNotFound')}
          body={t('recordNotFoundBody')}
          onClose={closeOpen}
        />
      ) : null}
      {running ? (
        <TextDialog
          onClose={() => setRunning(false)}
          title={t('runVerification')}
          description={t('runBody')}
          label={t('note')}
          placeholder={t('notePlaceholder')}
          required={false}
          maxLength={500}
          confirmLabel={t('runNow')}
          loading={run.isPending}
          onConfirm={(note) => run.mutate(note)}
        />
      ) : null}
    </div>
  )
}
