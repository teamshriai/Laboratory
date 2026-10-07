import {
  ArchiveIcon,
  CalendarClockIcon,
  FilePenLineIcon,
  SendIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  Undo2Icon,
  UserRoundIcon,
} from 'lucide-react'
import { useState } from 'react'
import { DAY } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useActor } from '@/hooks/use-permission'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type DocumentRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Detail } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Drawer } from '@/components/ui/dialog'
import {
  DUE_SOON_DAYS,
  documentState,
  useDepartmentLabel,
} from './records-shared'
import {
  DocumentStateBadge,
  Section,
  StatusText,
  TextDialog,
} from './records-ui'

type Pending = 'submit' | 'authorise' | 'return' | 'revise' | 'retire' | null

/** The review-due date with its overdue or due-soon flag. */
export function ReviewDue({ doc }: { doc: DocumentRow }) {
  const t = useT('qualityRecords')
  const f = useFormat()
  const now = useNow()
  if (doc.reviewDueAt === null)
    return <span className="text-meta text-fg-subtle">{t('noReviewDue')}</span>
  const soon =
    !doc.reviewOverdue && doc.reviewDueAt - now <= DUE_SOON_DAYS * DAY
  return (
    <span className="grid justify-items-start gap-0.5">
      <span className="text-meta whitespace-nowrap text-fg tabular-nums">
        {f.date(doc.reviewDueAt)}
      </span>
      {doc.reviewOverdue ? (
        <StatusText icon={<TriangleAlertIcon />} tone="danger">
          {t('reviewOverdue')}
        </StatusText>
      ) : soon ? (
        <StatusText icon={<CalendarClockIcon />} tone="warning">
          {t('reviewSoon')}
        </StatusText>
      ) : null}
    </span>
  )
}

export function DocumentDrawer({
  doc,
  onClose,
}: {
  doc: DocumentRow
  onClose: () => void
}) {
  const t = useT('qualityRecords')
  const f = useFormat()
  const dept = useDepartmentLabel()
  const actor = useActor()
  const [dialog, setDialog] = useState<Pending>(null)
  const close = () => setDialog(null)
  const name = (id: string | undefined) => (id ? (doc.names[id] ?? id) : '')
  const pending = doc.pending
  const current = doc.current

  const submit = useLabMutation(() => labApi.quality.submitDocument(doc.id), {
    success: () =>
      t('submitted', { code: doc.code, version: pending?.version ?? '' }),
  })
  const authorise = useLabMutation(
    () => labApi.quality.approveDocument(doc.id),
    {
      success: () =>
        t('authorised', { code: doc.code, version: pending?.version ?? '' }),
      onSuccess: close,
    },
  )
  const giveBack = useLabMutation(
    (reason: string) => labApi.quality.returnDocument(doc.id, reason),
    {
      success: () =>
        t('returned', { code: doc.code, version: pending?.version ?? '' }),
      onSuccess: close,
    },
  )
  const revise = useLabMutation(
    (summary: string) => labApi.quality.reviseDocument(doc.id, summary),
    {
      success: () => t('revisionStarted', { code: doc.code }),
      onSuccess: close,
    },
  )
  const retire = useLabMutation(
    (reason: string) => labApi.quality.retireDocument(doc.id, reason),
    {
      success: () =>
        t('retired', { code: doc.code, version: current?.version ?? '' }),
      onSuccess: close,
    },
  )

  const versions = doc.versions.toReversed()
  const ownVersion = Boolean(pending && actor && pending.createdBy === actor.id)

  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={doc.title}
      description={`${doc.code} · ${t(`docKind.${doc.kind}`)} · ${dept(doc.department)}`}
      headerExtra={<DocumentStateBadge state={documentState(doc)} />}
    >
      <Section title={t('sectionOverview')}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line p-4 sm:grid-cols-3">
          <Detail label={t('colInForce')}>
            {current ? t('versionShort', { version: current.version }) : '-'}
          </Detail>
          <Detail label={t('colEffective')}>
            {current?.effectiveFrom ? f.date(current.effectiveFrom) : '-'}
          </Detail>
          <Detail label={t('colReviewDue')}>
            <ReviewDue doc={doc} />
          </Detail>
          <Detail label={t('reviewEvery')}>
            {t('everyMonths', { count: doc.reviewMonths })}
          </Detail>
          <Detail label={t('kind')}>{t(`docKind.${doc.kind}`)}</Detail>
          <Detail label={t('versions')}>{doc.versions.length}</Detail>
        </dl>
        <p className="mt-2 text-xs text-fg-muted">
          {t('reviewRule', { count: doc.reviewMonths })}
        </p>
      </Section>

      <Section title={t('sectionNext')}>
        <div className="grid gap-3 rounded-xl border border-line p-4">
          {pending?.state === 'draft' ? (
            <>
              <p className="text-sm text-fg">
                {t('nextDraft', { version: pending.version })}
              </p>
              <div className="flex flex-wrap gap-2">
                <GuardedButton
                  permission="document.author"
                  variant="primary"
                  loading={submit.isPending}
                  onClick={() => submit.mutate(undefined)}
                >
                  <SendIcon />
                  {t('submitForReview')}
                </GuardedButton>
              </div>
            </>
          ) : pending?.state === 'in-review' ? (
            <>
              <p className="text-sm text-fg">
                {t('nextInReview', {
                  version: pending.version,
                  name: name(pending.createdBy),
                })}
              </p>
              <p className="text-meta text-fg-muted">{t('independentRule')}</p>
              {ownVersion ? (
                <StatusText icon={<UserRoundIcon />} tone="warning">
                  {t('ownVersion')}
                </StatusText>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <GuardedButton
                  permission="document.approve"
                  variant="primary"
                  onClick={() => setDialog('authorise')}
                >
                  <ShieldCheckIcon />
                  {t('authorise')}
                </GuardedButton>
                <GuardedButton
                  permission="document.approve"
                  onClick={() => setDialog('return')}
                >
                  <Undo2Icon />
                  {t('returnToAuthor')}
                </GuardedButton>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-fg">
                {current
                  ? t('nextInForce', { version: current.version })
                  : t('nextRetired')}
              </p>
              <div className="flex flex-wrap gap-2">
                <GuardedButton
                  permission="document.author"
                  variant={current ? 'secondary' : 'primary'}
                  onClick={() => setDialog('revise')}
                >
                  <FilePenLineIcon />
                  {t('startRevision')}
                </GuardedButton>
                {current ? (
                  <GuardedButton
                    permission="document.approve"
                    variant="danger-soft"
                    onClick={() => setDialog('retire')}
                  >
                    <ArchiveIcon />
                    {t('retire')}
                  </GuardedButton>
                ) : null}
              </div>
            </>
          )}
          {pending && current ? (
            <p className="text-meta text-fg-muted">
              {t('stillInForce', { version: current.version })}
            </p>
          ) : null}
        </div>
      </Section>

      <Section title={t('sectionHistory')}>
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {versions.map((v) => (
            <li key={v.version} className="grid gap-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-fg tabular-nums">
                  {t('versionShort', { version: v.version })}
                </span>
                <DocumentStateBadge state={v.state} />
              </div>
              <p className="text-sm leading-relaxed text-fg">{v.summary}</p>
              <dl className="grid gap-0.5 text-xs text-fg-muted">
                <div>
                  <dt className="inline">{t('writtenBy')} </dt>
                  <dd className="inline">
                    {t('whoWhen', {
                      name: name(v.createdBy),
                      time: f.dateTime(v.createdAt),
                    })}
                  </dd>
                </div>
                {v.approvedBy && v.approvedAt ? (
                  <div>
                    <dt className="inline">{t('authorisedBy')} </dt>
                    <dd className="inline">
                      {t('whoWhen', {
                        name: name(v.approvedBy),
                        time: f.dateTime(v.approvedAt),
                      })}
                    </dd>
                  </div>
                ) : null}
                {v.effectiveFrom ? (
                  <div>
                    <dt className="inline">{t('colEffective')} </dt>
                    <dd className="inline">{f.date(v.effectiveFrom)}</dd>
                  </div>
                ) : null}
                {v.retiredAt ? (
                  <div>
                    <dt className="inline">{t('retiredOn')} </dt>
                    <dd className="inline">{f.date(v.retiredAt)}</dd>
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ol>
      </Section>

      {dialog === 'authorise' && pending ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title={t('authoriseTitle', {
            code: doc.code,
            version: pending.version,
          })}
          description={
            current
              ? t('authoriseReplaces', {
                  version: pending.version,
                  previous: current.version,
                })
              : t('authoriseFirst', { version: pending.version })
          }
          confirmLabel={t('authorise')}
          loading={authorise.isPending}
          onConfirm={() => authorise.mutate(undefined)}
        >
          <p className="text-meta text-fg-muted">
            {t('reviewRule', { count: doc.reviewMonths })}
          </p>
        </ConfirmDialog>
      ) : null}
      {dialog === 'return' && pending ? (
        <TextDialog
          onClose={close}
          title={t('returnTitle', {
            code: doc.code,
            version: pending.version,
          })}
          description={t('returnBody')}
          label={t('reason')}
          confirmLabel={t('returnToAuthor')}
          loading={giveBack.isPending}
          onConfirm={(reason) => giveBack.mutate(reason)}
        />
      ) : null}
      {dialog === 'revise' ? (
        <TextDialog
          onClose={close}
          title={t('reviseTitle', { code: doc.code })}
          description={t('reviseBody')}
          label={t('versionSummary')}
          hint={t('versionSummaryHint')}
          confirmLabel={t('startRevision')}
          loading={revise.isPending}
          onConfirm={(summary) => revise.mutate(summary)}
        />
      ) : null}
      {dialog === 'retire' && current ? (
        <TextDialog
          onClose={close}
          title={t('retireTitle', {
            code: doc.code,
            version: current.version,
          })}
          description={t('retireBody')}
          label={t('reason')}
          confirmLabel={t('retire')}
          tone="danger"
          loading={retire.isPending}
          onConfirm={(reason) => retire.mutate(reason)}
        />
      ) : null}
    </Drawer>
  )
}
