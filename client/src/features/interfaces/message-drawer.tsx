import { RecordLink } from '@/components/lab/record-link'
import { InfoIcon, ListTreeIcon, RotateCwIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { InterfaceMessageRow } from '@/services/lab-api'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Drawer } from '@/components/ui/dialog'
import { SkeletonText } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { DirectionLabel, MessageStateBadge } from './interface-status'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  )
}

/** One message: where it went, why it failed and its frame. */
export function MessageDrawer({
  message: m,
  isPending,
  retrying,
  onRetry,
  onMap,
  onClose,
}: {
  message: InterfaceMessageRow | undefined
  isPending: boolean
  retrying: boolean
  onRetry: (m: InterfaceMessageRow) => void
  onMap: (m: InterfaceMessageRow) => void
  onClose: () => void
}) {
  const t = useT('interfaces')
  const f = useFormat()
  const canRetry = m?.state === 'error'
  return (
    <Drawer
      open
      size="md"
      onOpenChange={(o) => !o && onClose()}
      title={m ? `${m.equipmentName} · ${t(`kind.${m.kind}`)}` : t('message')}
      description={m ? f.dateTime(m.at) : undefined}
      headerExtra={m ? <MessageStateBadge state={m.state} /> : null}
      footer={
        m && canRetry ? (
          <>
            {m.error === 'unmapped-code' && m.instrumentCode ? (
              <GuardedButton
                permission="interface.manage"
                onClick={() => onMap(m)}
              >
                <ListTreeIcon />
                {t('mapThisCode')}
              </GuardedButton>
            ) : null}
            <GuardedButton
              permission="interface.manage"
              variant="primary"
              loading={retrying}
              onClick={() => onRetry(m)}
            >
              <RotateCwIcon />
              {t('retry')}
            </GuardedButton>
          </>
        ) : undefined
      }
    >
      {m ? (
        <div className="grid gap-5">
          {m.error ? (
            <div
              role="note"
              className="flex items-start gap-2 rounded-lg border border-danger-text/25 bg-danger-soft px-3 py-2.5 text-meta text-danger-text"
            >
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                <span className="block font-semibold">
                  {t(`error.${m.error}`)}
                </span>
                {t(`errorHelp.${m.error}`, {
                  code: m.instrumentCode ?? '-',
                })}
              </p>
            </div>
          ) : null}
          <dl className="grid gap-x-6 gap-y-3 text-meta sm:grid-cols-2">
            <Fact label={t('analyser')}>{m.equipmentName}</Fact>
            <Fact label={t('protocol')}>
              <span className="font-mono">{m.protocol}</span>
            </Fact>
            <Fact label={t('colDirection')}>
              <DirectionLabel direction={m.direction} />
            </Fact>
            <Fact label={t('colKind')}>{t(`kind.${m.kind}`)}</Fact>
            <Fact label={t('colAccession')}>
              {m.sampleId && m.accessionNo ? (
                <RecordLink kind="specimen" id={m.sampleId}>
                  {m.accessionNo}
                </RecordLink>
              ) : (
                <span className="font-mono tabular-nums">
                  {m.accessionNo ?? '-'}
                </span>
              )}
            </Fact>
            <Fact label={t('instrumentCode')}>
              <span className="font-mono">{m.instrumentCode ?? '-'}</span>
            </Fact>
            <Fact label={t('colRetries')}>
              <span className="tabular-nums">{f.number(m.retries)}</span>
            </Fact>
          </dl>
          <section aria-labelledby="interface-frame-title">
            <h3
              id="interface-frame-title"
              className="mb-2 text-sm font-semibold text-fg"
            >
              {t('frame')}
            </h3>
            <pre className="scrollbar-thin overflow-x-auto rounded-xl border border-line bg-surface-2 px-4 py-3 font-mono text-meta whitespace-pre-wrap text-fg">
              {m.frame}
            </pre>
            <p className="mt-2 text-xs text-fg-subtle">{t('frameNote')}</p>
          </section>
        </div>
      ) : isPending ? (
        <SkeletonText lines={6} />
      ) : (
        <EmptyState
          compact
          icon={<InfoIcon />}
          tone="slate"
          title={t('messageGoneTitle')}
          description={t('messageGoneBody')}
        />
      )}
    </Drawer>
  )
}
