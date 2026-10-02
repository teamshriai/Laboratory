import { RefreshCwIcon, CirclePauseIcon, CircleXIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { SampleDetail } from '@/services/lab-api'
import { WorkflowTimeline } from '@/components/lab/workflow-timeline'
import { HistoryTimeline } from '@/components/lab/history'
import { RangeText, ResultFlag, valueTone } from '@/components/lab/result'
import { ContainerChip } from '@/components/lab/sample'
import { ResultStatusBadge } from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { Detail } from '@/components/ui/card'

export function SampleAlerts({ sample }: { sample: SampleDetail }) {
  const t = useT('processing')
  const e = useEnum()
  const f = useFormat()
  return (
    <>
      {sample.status === 'rejected' && sample.rejection ? (
        <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft/60 p-4">
          <CircleXIcon className="mt-0.5 size-5 shrink-0 text-danger-text" />
          <div className="min-w-0 text-meta">
            <p className="font-semibold text-danger-text">
              {t('rejectedTitle')}
            </p>
            <p className="mt-0.5 text-fg">
              {t('rejectedBody', {
                reason: e('rejectionReason', sample.rejection.reason),
                time: f.dateTime(sample.rejection.at),
                by: sample.rejection.byName,
              })}
            </p>
            {sample.rejection.remarks ? (
              <p className="mt-1 text-fg-muted">{sample.rejection.remarks}</p>
            ) : null}
            {sample.recollectedBy ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 font-medium text-fg">
                <RefreshCwIcon className="size-3.5" />
                {t('recollectionRequested', {
                  accession: sample.recollectedBy,
                })}
              </p>
            ) : sample.rejection.recollectionRequested ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 font-medium text-fg">
                <RefreshCwIcon className="size-3.5" />
                {t('recollectionPending')}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {sample.status === 'on_hold' ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft/70 p-4">
          <CirclePauseIcon className="mt-0.5 size-5 shrink-0 text-warning-text" />
          <div className="text-meta">
            <p className="font-semibold text-warning-text">{t('heldTitle')}</p>
            <p className="mt-0.5 text-fg">
              {sample.holdReason ? e('holdReason', sample.holdReason) : ''}
              {sample.heldAt ? ` · ${f.dateTime(sample.heldAt)}` : ''}
            </p>
            {sample.holdRemarks ? (
              <p className="mt-1 text-fg-muted">{sample.holdRemarks}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {sample.isRecollection && sample.recollectionOf ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-meta text-fg">
          <RefreshCwIcon className="size-4 text-warning-text" />
          {t('replacesSample', { accession: sample.recollectionOf })}
        </div>
      ) : null}
    </>
  )
}

export function SampleDetails({ sample }: { sample: SampleDetail }) {
  const t = useT('processing')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
      <Detail label={tc('container')}>
        <ContainerChip container={sample.container} full className="text-sm" />
      </Detail>
      <Detail label={tc('specimen')}>{e('specimen', sample.specimen)}</Detail>
      <Detail label={tc('department')}>
        {e('department', sample.department)}
      </Detail>
      <Detail label={t('volume')}>
        {sample.volumeMl ? `${f.decimal(sample.volumeMl)} mL` : '-'}
      </Detail>
      <Detail label={tc('collectedAt')}>
        {sample.collectedAt ? f.dateTime(sample.collectedAt) : '-'}
      </Detail>
      <Detail label={t('collectedBy')}>{sample.collectedBy ?? '-'}</Detail>
      <Detail label={t('collectionSite')}>
        {sample.collectionSite
          ? e('collectionSite', sample.collectionSite)
          : '-'}
      </Detail>
      <Detail label={tc('receivedAt')}>
        {sample.receivedAt ? f.dateTime(sample.receivedAt) : '-'}
      </Detail>
      <Detail label={t('processingStarted')}>
        {sample.processingStartedAt
          ? f.dateTime(sample.processingStartedAt)
          : '-'}
      </Detail>
      <Detail label={t('equipment')}>{sample.equipment?.name ?? '-'}</Detail>
      <Detail label={t('tat')}>
        {sample.tat ? <TatIndicator tat={sample.tat} /> : '-'}
      </Detail>
      <Detail label={t('completedAt')}>
        {sample.completedAt ? f.dateTime(sample.completedAt) : '-'}
      </Detail>
    </dl>
  )
}

export function SampleTests({ sample }: { sample: SampleDetail }) {
  const t = useT('processing')
  const tc = useT('common')
  return (
    <div className="grid gap-3">
      {sample.items.map((item) => (
        <div
          key={item.itemId}
          className="overflow-hidden rounded-xl border border-line"
        >
          <div className="flex items-center justify-between gap-3 bg-surface-2/60 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">
                {item.name}
              </p>
              <p className="font-mono text-2xs text-fg-subtle">{item.code}</p>
            </div>
            <ResultStatusBadge status={item.status} />
          </div>
          {item.results.length === 0 ? (
            <p className="px-4 py-3 text-meta text-fg-muted">
              {t('noResultsYet')}
            </p>
          ) : (
            <table className="w-full text-meta">
              <thead className="sr-only">
                <tr>
                  <th>{tc('test')}</th>
                  <th>{tc('result')}</th>
                  <th>{tc('referenceRange')}</th>
                  <th>{tc('flag')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {item.results.map((r) => {
                  const critical = r.critical
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-fg">{r.name}</td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums ${valueTone(r.flag, critical)}`}
                      >
                        {r.value ?? '-'}{' '}
                        <span className="text-xs font-normal text-fg-subtle">
                          {r.unit}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-xs">
                        <RangeText range={r.range} />
                      </td>
                      <td className="w-20 px-4 py-2 text-right">
                        <ResultFlag
                          flag={r.flag}
                          critical={critical}
                          variant="short"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}

export function SampleTimeline({ sample }: { sample: SampleDetail }) {
  const t = useT('history')
  return (
    <div className="grid gap-4">
      <WorkflowTimeline milestones={sample.milestones} />
      <details className="group rounded-lg border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-meta font-medium text-fg-muted hover:text-fg">
          {t('fullHistory')}
          <span className="text-xs text-fg-subtle tabular-nums">
            {sample.history.length}
          </span>
        </summary>
        <div className="border-t border-line p-3">
          <HistoryTimeline entries={sample.history} />
        </div>
      </details>
    </div>
  )
}

export function SampleOrderLinks({ sample }: { sample: SampleDetail }) {
  const t = useT('processing')
  return (
    <div className="grid gap-2 text-meta">
      <p>
        <Link
          to={`/orders?order=${sample.orderId}`}
          className="font-mono font-medium text-accent-text hover:underline"
        >
          {sample.orderNo}
        </Link>{' '}
        <span className="text-fg-muted">· {sample.doctorName}</span>
      </p>
      {sample.clinicalNotes ? (
        <p className="rounded-lg bg-surface-2 p-2.5 text-fg">
          {sample.clinicalNotes}
        </p>
      ) : null}
      {sample.reportIds.length ? (
        <div className="flex flex-wrap gap-2">
          {sample.reportIds.map((id) => (
            <Link
              key={id}
              to={`/reports/${id}`}
              className="text-xs font-medium text-accent-text hover:underline"
            >
              {t('sectionReports')}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
