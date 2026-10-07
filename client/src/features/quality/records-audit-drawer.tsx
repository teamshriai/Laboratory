import {
  CircleCheckIcon,
  ClipboardListIcon,
  PlayIcon,
  PlusIcon,
  SearchCheckIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type InternalAuditRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Detail } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Drawer } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/states'
import { FindingDialog } from './records-audit-dialogs'
import { useDepartmentLabel } from './records-shared'
import {
  AuditStateBadge,
  FindingKindBadge,
  Section,
  StatusText,
  TextDialog,
} from './records-ui'

type Pending = 'start' | 'finding' | 'complete' | null

export function AuditDrawer({
  audit,
  onClose,
}: {
  audit: InternalAuditRow
  onClose: () => void
}) {
  const t = useT('qualityRecords')
  const f = useFormat()
  const dept = useDepartmentLabel()
  const [dialog, setDialog] = useState<Pending>(null)
  const close = () => setDialog(null)
  const start = useLabMutation(() => labApi.quality.startAudit(audit.id), {
    success: () => t('auditStarted', { audit: audit.auditNo }),
    onSuccess: close,
  })
  const complete = useLabMutation(
    (summary: string) => labApi.quality.completeAudit(audit.id, summary),
    {
      success: () => t('auditCompleted', { audit: audit.auditNo }),
      onSuccess: close,
    },
  )
  const ncCount = audit.findings.filter((x) => x.ncId).length

  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={audit.area}
      description={`${audit.auditNo} · ${dept(audit.department)}`}
      headerExtra={<AuditStateBadge state={audit.state} />}
    >
      <Section title={t('sectionOverview')}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line p-4 sm:grid-cols-3">
          <Detail label={t('clauses')}>{audit.clauses}</Detail>
          <Detail label={t('colDepartment')}>{dept(audit.department)}</Detail>
          <Detail label={t('auditor')}>{audit.auditorName}</Detail>
          <Detail label={t('plannedFor')}>{f.date(audit.plannedFor)}</Detail>
          <Detail label={t('startedOn')}>
            {audit.startedAt ? f.dateTime(audit.startedAt) : '-'}
          </Detail>
          <Detail label={t('completedOn')}>
            {audit.completedAt ? f.dateTime(audit.completedAt) : '-'}
          </Detail>
        </dl>
      </Section>

      {audit.state === 'planned' || audit.state === 'in-progress' ? (
        <Section title={t('sectionNext')}>
          <div className="grid gap-3 rounded-xl border border-line p-4">
            <p className="text-sm text-fg">
              {audit.state === 'planned'
                ? t('nextPlanned')
                : t('nextInProgress')}
            </p>
            <div className="flex flex-wrap gap-2">
              {audit.state === 'planned' ? (
                <GuardedButton
                  permission="quality.record"
                  variant="primary"
                  onClick={() => setDialog('start')}
                >
                  <PlayIcon />
                  {t('startAudit')}
                </GuardedButton>
              ) : (
                <>
                  <GuardedButton
                    permission="quality.record"
                    variant="primary"
                    onClick={() => setDialog('finding')}
                  >
                    <PlusIcon />
                    {t('addFinding')}
                  </GuardedButton>
                  <GuardedButton
                    permission="quality.record"
                    onClick={() => setDialog('complete')}
                  >
                    <CircleCheckIcon />
                    {t('completeAudit')}
                  </GuardedButton>
                </>
              )}
            </div>
          </div>
        </Section>
      ) : null}

      {audit.summary ? (
        <Section title={t('auditSummary')}>
          <p className="rounded-xl border border-line px-4 py-3 text-sm leading-relaxed text-fg">
            {audit.summary}
          </p>
        </Section>
      ) : null}

      <Section
        title={t('findingsCount', { count: audit.findings.length })}
        action={
          ncCount ? (
            <span className="text-xs text-fg-muted">
              {t('ncsRaised', { count: ncCount })}
            </span>
          ) : undefined
        }
      >
        {audit.findings.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {audit.findings.map((finding) => {
              const ncNo = finding.ncId ? audit.ncNos[finding.ncId] : undefined
              return (
                <li key={finding.id} className="grid gap-1.5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <FindingKindBadge kind={finding.kind} />
                    <span className="text-meta font-medium text-fg tabular-nums">
                      {t('clauseNo', { clause: finding.clause })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-fg">
                    {finding.text}
                  </p>
                  {ncNo ? (
                    <StatusText icon={<ClipboardListIcon />} tone="danger">
                      {t('ncRaisedAs', { nc: ncNo })}
                    </StatusText>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-line">
            <EmptyState
              compact
              icon={<SearchCheckIcon />}
              tone="violet"
              title={t('noFindings')}
              description={
                audit.state === 'completed'
                  ? t('noFindingsCompleted')
                  : t('noFindingsBody')
              }
            />
          </div>
        )}
      </Section>

      {dialog === 'start' ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title={t('startTitle', { audit: audit.auditNo })}
          description={t('startBody', { auditor: audit.auditorName })}
          confirmLabel={t('startAudit')}
          loading={start.isPending}
          onConfirm={() => start.mutate(undefined)}
        />
      ) : null}
      {dialog === 'finding' ? (
        <FindingDialog audit={audit} onClose={close} />
      ) : null}
      {dialog === 'complete' ? (
        <TextDialog
          onClose={close}
          title={t('completeTitle', { audit: audit.auditNo })}
          description={t('completeBody', {
            count: audit.findings.length,
          })}
          label={t('auditSummary')}
          confirmLabel={t('completeAudit')}
          loading={complete.isPending}
          onConfirm={(summary) => complete.mutate(summary)}
        />
      ) : null}
    </Drawer>
  )
}
