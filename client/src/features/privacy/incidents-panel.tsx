import { CircleCheckIcon, ShieldAlertIcon, SirenIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { BREACH_STEPS, type BreachStep } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type BreachRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { SigningAs } from '@/components/lab/signing-as'
import { Card, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Drawer } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import { LogIncidentDialog } from './incident-dialog'
import { stepTimes } from './privacy'
import { Deadline, EventTimeline, IncidentState, Item } from './privacy-ui'

/** An unreported deadline that has passed, or one reported late. */
const needsAttention = (b: BreachRow) =>
  b.state !== 'closed' &&
  ((!b.certInReportedAt && b.certInLate) || (!b.boardReportedAt && b.boardLate))

export function IncidentsPanel({
  breaches,
  isPending,
  isError,
  onRetry,
}: {
  breaches: BreachRow[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('privacy')
  const f = useFormat()
  const now = useNow()
  const [openId, setOpenId, closeOpen] = useOverlayParam('incident')
  const [logging, setLogging] = useState(false)
  const selected = breaches?.find((b) => b.id === openId)

  const columns: Column<BreachRow>[] = [
    {
      id: 'number',
      header: t('colNumber'),
      cell: (b) => (
        <span className="font-mono text-meta font-semibold whitespace-nowrap text-fg">
          {b.breachNo}
        </span>
      ),
    },
    {
      id: 'title',
      header: t('colIncident'),
      cell: (b) => (
        <div className="grid max-w-64 min-w-0 gap-0.5">
          <span className="truncate text-meta font-medium text-fg">
            {b.title}
          </span>
          <span className="text-xs text-fg-muted">
            {t('affected', { count: b.affectedCount })}
          </span>
        </div>
      ),
    },
    {
      id: 'detected',
      header: t('colDetected'),
      tabletHidden: true,
      cell: (b) => (
        <span className="text-meta whitespace-nowrap text-fg-muted tabular-nums">
          {f.dateTime(b.detectedAt)}
        </span>
      ),
    },
    {
      id: 'certIn',
      header: t('colCertIn'),
      cell: (b) => (
        <Deadline
          compact
          dueAt={b.certInDueAt}
          doneAt={b.certInReportedAt}
          late={b.certInLate}
          now={now}
        />
      ),
    },
    {
      id: 'board',
      header: t('colBoard'),
      cell: (b) => (
        <Deadline
          compact
          dueAt={b.boardDueAt}
          doneAt={b.boardReportedAt}
          late={b.boardLate}
          now={now}
        />
      ),
    },
    {
      id: 'state',
      header: t('colState'),
      cell: (b) => <IncidentState state={b.state} />,
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={t('incidentsTitle')}
        description={t('incidentsDescription')}
        icon={<SirenIcon />}
        tone="red"
        action={
          <GuardedButton
            permission="privacy.manage"
            variant="primary"
            onClick={() => setLogging(true)}
          >
            <ShieldAlertIcon />
            {t('logIncident')}
          </GuardedButton>
        }
      />
      <div className="border-t border-line">
        <DataTable
          caption={t('incidentsTitle')}
          columns={columns}
          rows={breaches}
          getRowId={(b) => b.id}
          isLoading={isPending}
          isError={isError}
          onRetry={onRetry}
          onRowClick={(b) => setOpenId(b.id)}
          rowLabel={(b) => `${b.breachNo} ${b.title}`}
          activeRowId={selected?.id ?? null}
          rowClassName={(b) => (needsAttention(b) ? 'row-alert' : undefined)}
          pageSize={20}
          mobile={{ primary: 'title', fields: ['certIn', 'board', 'state'] }}
          empty={
            <EmptyState
              compact
              icon={<SirenIcon />}
              tone="red"
              title={t('incidentsEmpty')}
              description={t('incidentsEmptyBody')}
            />
          }
        />
      </div>
      <Drawer
        open={Boolean(selected)}
        onOpenChange={(o) => !o && closeOpen()}
        title={
          selected ? (
            <span className="font-mono">{selected.breachNo}</span>
          ) : (
            t('incidentsTitle')
          )
        }
        headerExtra={selected ? <IncidentState state={selected.state} /> : null}
        description={selected?.title}
      >
        {selected ? (
          <IncidentDetail key={selected.id} breach={selected} />
        ) : null}
      </Drawer>
      <LogIncidentDialog
        open={logging}
        onOpenChange={setLogging}
        onLogged={(id) => {
          setLogging(false)
          setOpenId(id)
        }}
      />
    </Card>
  )
}

function DeadlineCard({
  title,
  rule,
  children,
}: {
  title: string
  rule: string
  children: ReactNode
}) {
  return (
    <div className="grid content-start gap-2 rounded-xl border border-line p-3.5">
      <div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="text-xs text-fg-subtle">{rule}</p>
      </div>
      {children}
    </div>
  )
}

function IncidentDetail({ breach }: { breach: BreachRow }) {
  const t = useT('privacy')
  const f = useFormat()
  const now = useNow()
  const [step, setStep] = useState<BreachStep | null>(null)
  const times = stepTimes(breach)
  const closed = breach.state === 'closed'
  const canClose = Boolean(
    breach.containedAt && breach.certInReportedAt && breach.boardReportedAt,
  )

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <DeadlineCard title={t('certInTitle')} rule={t('certInRule')}>
          <Deadline
            dueAt={breach.certInDueAt}
            doneAt={breach.certInReportedAt}
            late={breach.certInLate}
            now={now}
          />
        </DeadlineCard>
        <DeadlineCard title={t('boardTitle')} rule={t('boardRule')}>
          <Deadline
            dueAt={breach.boardDueAt}
            doneAt={breach.boardReportedAt}
            late={breach.boardLate}
            now={now}
          />
        </DeadlineCard>
      </div>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Item label={t('colDetected')}>{f.dateTime(breach.detectedAt)}</Item>
        <Item label={t('detectedBy')}>{breach.detectedByName}</Item>
        <Item label={t('fieldAffected')}>{f.number(breach.affectedCount)}</Item>
        <Item label={t('fieldDataKinds')}>{breach.dataKinds}</Item>
      </dl>

      <section className="grid gap-1.5">
        <h3 className="text-sm font-semibold text-fg">
          {t('fieldDescription')}
        </h3>
        <p className="text-sm whitespace-pre-line text-fg">
          {breach.description}
        </p>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-fg">{t('stepsTitle')}</h3>
        <ol className="grid gap-2">
          {BREACH_STEPS.map((s) => {
            const at = times[s]
            const blocked = s === 'closed' && !canClose
            return (
              <li
                key={s}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-line px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">
                    {t(`step.${s}`)}
                  </p>
                  {at ? (
                    <p className="inline-flex items-center gap-1 text-xs text-success-text">
                      <CircleCheckIcon className="size-3.5" aria-hidden />
                      {t('stepDone', { time: f.dateTime(at) })}
                    </p>
                  ) : blocked && !closed ? (
                    <p className="text-xs text-fg-subtle">{t('closeNeeds')}</p>
                  ) : null}
                </div>
                {!at && !closed ? (
                  <GuardedButton
                    permission="privacy.manage"
                    size="sm"
                    variant={s === 'closed' ? 'primary' : 'secondary'}
                    disabled={blocked}
                    onClick={() => setStep(s)}
                  >
                    {t('recordStep')}
                  </GuardedButton>
                ) : null}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-fg">{t('history')}</h3>
        <EventTimeline entries={breach.history} />
      </section>

      <StepDialog breach={breach} step={step} onClose={() => setStep(null)} />
    </div>
  )
}

function StepDialog({
  breach,
  step,
  onClose,
}: {
  breach: BreachRow
  step: BreachStep | null
  onClose: () => void
}) {
  const t = useT('privacy')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const record = useLabMutation(
    (v: { step: BreachStep; note: string }) =>
      labApi.privacy.updateBreach(breach.id, v.step, v.note),
    {
      success: (_, v) => t('stepRecorded', { step: t(`step.${v.step}`) }),
      onSuccess: () => close(),
    },
  )
  const close = () => {
    setNote('')
    setTried(false)
    onClose()
  }
  const error = tried && !note.trim() ? t('noteRequired') : undefined
  return (
    <ConfirmDialog
      open={step !== null}
      onOpenChange={(o) => !o && close()}
      title={step ? t(`step.${step}`) : ''}
      description={t('stepDescription', { no: breach.breachNo })}
      confirmLabel={t('recordStep')}
      loading={record.isPending}
      onConfirm={() => {
        setTried(true)
        if (!step || !note.trim()) return
        record.mutate({ step, note: note.trim() })
      }}
    >
      <div className="grid gap-3">
        <Field
          label={t('stepNote')}
          hint={step ? t(`stepHint.${step}`) : undefined}
          required
          error={error}
        >
          <Textarea
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
          />
        </Field>
        <SigningAs permission="privacy.manage" compact />
      </div>
    </ConfirmDialog>
  )
}
