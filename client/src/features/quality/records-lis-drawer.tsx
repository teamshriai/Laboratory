import {
  CheckIcon,
  InfoIcon,
  UserCheckIcon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { LisCheck } from '@/domain/types'
import { useActor } from '@/hooks/use-permission'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type LisVerificationRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Detail } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Drawer } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/states'
import { AccessionLink, OutcomeBadge, Section, StatusText } from './records-ui'

type Row = LisCheck & { key: string }

/** Match or mismatch, in words and with an icon. */
export function MatchText({ match }: { match: boolean }) {
  const t = useT('qualityRecords')
  return match ? (
    <StatusText icon={<CheckIcon />} tone="success">
      {t('match')}
    </StatusText>
  ) : (
    <StatusText icon={<XIcon />} tone="danger">
      {t('mismatch')}
    </StatusText>
  )
}

export function LisDrawer({
  run,
  onClose,
}: {
  run: LisVerificationRow
  onClose: () => void
}) {
  const t = useT('qualityRecords')
  const e = useEnum()
  const f = useFormat()
  const actor = useActor()
  const [confirming, setConfirming] = useState(false)
  const review = useLabMutation(
    () => labApi.quality.reviewLisVerification(run.id),
    {
      success: () => t('lisReviewed', { run: run.runNo }),
      onSuccess: () => setConfirming(false),
    },
  )
  const rows: Row[] = run.checks.map((c, i) => ({ ...c, key: String(i) }))
  const mismatches = run.checks.filter((c) => !c.match).length
  const ownRun = Boolean(actor && actor.id === run.performedBy)

  const value = (v: string, match: boolean) => (
    <span
      className={
        match
          ? 'font-mono text-meta whitespace-nowrap text-fg tabular-nums'
          : 'font-mono text-meta font-semibold whitespace-nowrap text-danger-text tabular-nums'
      }
    >
      {v}
    </span>
  )

  const columns: Column<Row>[] = [
    {
      id: 'specimen',
      header: t('colSpecimen'),
      cell: (c) => (
        <div className="min-w-0">
          <AccessionLink accessionNo={c.accessionNo} />
          <p className="text-xs whitespace-nowrap text-fg-muted">
            {e('specimen', c.specimen)}
          </p>
        </div>
      ),
    },
    {
      id: 'test',
      header: t('colTestAnalyte'),
      cell: (c) => (
        <div className="max-w-44 min-w-0">
          <p className="font-mono text-xs text-fg-muted">{c.testCode}</p>
          <p className="truncate text-meta text-fg">{c.analyte}</p>
        </div>
      ),
    },
    {
      id: 'instrument',
      header: t('colAnalyserValue'),
      align: 'right',
      cell: (c) => value(c.instrumentValue, c.instrumentValue === c.lisValue),
    },
    {
      id: 'lis',
      header: t('colLisValue'),
      align: 'right',
      cell: (c) => value(c.lisValue, true),
    },
    {
      id: 'report',
      header: t('colReportValue'),
      align: 'right',
      cell: (c) => value(c.reportValue, c.match),
    },
    {
      id: 'match',
      header: t('colMatch'),
      cell: (c) => <MatchText match={c.match} />,
    },
  ]

  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={t('lisRunTitle', { run: run.runNo })}
      description={f.dateTime(run.performedAt)}
      headerExtra={<OutcomeBadge outcome={run.outcome} />}
    >
      <Section title={t('sectionOverview')}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line p-4 sm:grid-cols-4">
          <Detail label={t('performedBy')}>{run.performedByName}</Detail>
          <Detail label={t('specimensCompared')}>
            {f.number(run.checks.length)}
          </Detail>
          <Detail label={t('mismatches')}>{f.number(mismatches)}</Detail>
          <Detail label={t('reviewedBy')}>
            {run.reviewedByName && run.reviewedAt
              ? run.reviewedByName
              : t('awaitingReview')}
          </Detail>
        </dl>
        {run.note ? (
          <p className="mt-3 rounded-xl border border-line px-4 py-3 text-sm leading-relaxed text-fg">
            <span className="block text-xs text-fg-subtle">{t('note')}</span>
            {run.note}
          </p>
        ) : null}
        <p className="mt-3 flex gap-2 text-meta text-fg-muted">
          <InfoIcon
            className="mt-0.5 size-4 shrink-0 text-info-text"
            aria-hidden
          />
          {t('simulatedNote')}
        </p>
      </Section>

      <Section title={t('sectionReview')}>
        <div className="grid gap-3 rounded-xl border border-line p-4">
          {run.reviewedAt && run.reviewedByName ? (
            <StatusText icon={<UserCheckIcon />} tone="success">
              {t('reviewedWhoWhen', {
                name: run.reviewedByName,
                time: f.dateTime(run.reviewedAt),
              })}
            </StatusText>
          ) : (
            <>
              <p className="text-sm text-fg">
                {run.outcome === 'pass'
                  ? t('reviewPass')
                  : t('reviewFail', { count: mismatches })}
              </p>
              <p className="text-meta text-fg-muted">{t('lisReviewRule')}</p>
              {ownRun ? (
                <StatusText icon={<UserRoundIcon />} tone="warning">
                  {t('ownRun')}
                </StatusText>
              ) : null}
              <div>
                <GuardedButton
                  permission="quality.manage"
                  variant="primary"
                  onClick={() => setConfirming(true)}
                >
                  <UserCheckIcon />
                  {t('reviewRun')}
                </GuardedButton>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section title={t('sectionChecks')}>
        <div className="overflow-hidden rounded-xl border border-line">
          <DataTable
            caption={t('sectionChecks')}
            columns={columns}
            rows={rows}
            getRowId={(c) => c.key}
            rowClassName={(c) => (c.match ? undefined : 'row-alert')}
            pageSize={50}
            mobile={{
              primary: 'specimen',
              fields: ['test', 'instrument', 'lis', 'report', 'match'],
            }}
            empty={
              <EmptyState
                compact
                icon={<InfoIcon />}
                tone="teal"
                title={t('noChecks')}
              />
            }
          />
        </div>
      </Section>

      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirming(false)}
          title={t('reviewTitle', { run: run.runNo })}
          description={
            run.outcome === 'pass'
              ? t('reviewPass')
              : t('reviewFail', { count: mismatches })
          }
          confirmLabel={t('reviewRun')}
          loading={review.isPending}
          onConfirm={() => review.mutate(undefined)}
        />
      ) : null}
    </Drawer>
  )
}
