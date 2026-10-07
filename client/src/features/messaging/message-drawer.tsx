import { FileTextIcon, InboxIcon, InfoIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEnum, useT } from '@/i18n/context'
import { LANGUAGE_NAMES } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import type { MessagingView } from '@/services/lab-api'
import { RecordLink } from '@/components/lab/record-link'
import { Drawer } from '@/components/ui/dialog'
import { SkeletonText } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { ChannelLabel, MessageStateBadge } from './channel'

type Message = MessagingView['outbox'][number]

/** One recorded message: who it was for, why it was not sent, its text. */
export function MessageDrawer({
  message: m,
  isPending,
  onClose,
}: {
  message: Message | undefined
  isPending: boolean
  onClose: () => void
}) {
  const t = useT('network')
  const e = useEnum()
  const f = useFormat()
  return (
    <Drawer
      open
      size="md"
      onOpenChange={(o) => !o && onClose()}
      title={m ? e('messageEvent', m.event) : t('messageTitle')}
      description={m ? f.dateTime(m.at) : undefined}
      headerExtra={m ? <MessageStateBadge state={m.state} /> : null}
    >
      {m ? (
        <div className="grid gap-5">
          {m.reason ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning-text/25 bg-warning-soft px-3 py-2.5 text-meta text-warning-text">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">
                  {e('messageReason', m.reason)}
                </span>
                {m.reason === 'no-gateway' ? (
                  <span className="block">{t('notSentExplain')}</span>
                ) : null}
              </span>
            </p>
          ) : null}
          <dl className="grid gap-x-6 gap-y-3 text-meta sm:grid-cols-2">
            <Fact label={t('colChannel')}>
              <ChannelLabel channel={m.channel} />
            </Fact>
            <Fact label={t('colRecipient')}>
              <span className="break-all tabular-nums">{m.to}</span>
            </Fact>
            <Fact label={t('colPatient')}>
              {m.patientId ? (
                <RecordLink kind="patient" id={m.patientId} mono={false}>
                  {m.patientName ?? t('openPatient')}
                </RecordLink>
              ) : (
                '-'
              )}
            </Fact>
            <Fact label={t('colLanguage')}>{LANGUAGE_NAMES[m.language]}</Fact>
            <Fact label={t('colBy')}>{m.byName}</Fact>
            {m.relatedId &&
            (m.event === 'report-ready' || m.event === 'report-link') ? (
              <Fact label={t('relatedReport')}>
                <RecordLink kind="report" id={m.relatedId} mono={false}>
                  <FileTextIcon className="mr-1.5 size-4" aria-hidden />
                  {m.relatedLabel ?? t('openReport')}
                </RecordLink>
              </Fact>
            ) : null}
          </dl>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-fg">
              {t('messageText')}
            </h3>
            {m.text ? (
              <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-line text-fg">
                {m.text}
              </p>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-4 py-3 text-meta text-fg-muted">
                {t('messageNoText')}
              </p>
            )}
          </section>
        </div>
      ) : isPending ? (
        <SkeletonText lines={6} />
      ) : (
        <EmptyState
          compact
          icon={<InboxIcon />}
          tone="sky"
          title={t('messageNotFound')}
          description={t('messageNotFoundBody')}
        />
      )}
    </Drawer>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  )
}
