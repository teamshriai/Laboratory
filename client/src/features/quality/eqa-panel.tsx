import { zodResolver } from '@hookform/resolvers/zod'
import { InfoIcon, SendIcon, SigmaIcon, TargetIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from '@/features/shared/zod'
import { eqaOutcome, eqaZScore } from '@/domain/quality'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { focusInvalid } from '@/lib/form-errors'
import { labApi, type EqaRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useEqa } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import { parseDecimal, useQualityMessage } from './quality'
import { EqaOutcomeBadge, OverdueText } from './quality-badges'

const decimal = z
  .string()
  .trim()
  .min(1, 'forms.required')
  .refine((v) => parseDecimal(v) !== null, 'forms.invalidNumber')

const signed = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))

function RoundSummary({ row }: { row: EqaRow }) {
  const t = useT('quality')
  const f = useFormat()
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-2/60 p-3.5 text-meta">
      <div className="min-w-0">
        <dt className="text-xs text-fg-subtle">{t('eqaRound')}</dt>
        <dd className="font-medium text-fg">
          {row.scheme} {row.roundNo}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-fg-subtle">{t('eqaAnalyte')}</dt>
        <dd className="font-medium text-fg">{row.analyteName}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-fg-subtle">{t('eqaAnalyser')}</dt>
        <dd className="font-medium text-fg">{row.equipmentName ?? '-'}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-fg-subtle">{t('eqaDue')}</dt>
        <dd className="font-medium text-fg">{f.date(row.dueAt)}</dd>
      </div>
    </dl>
  )
}

const submitSchema = z.object({ value: decimal })

function SubmitDialog({ row, onClose }: { row: EqaRow; onClose: () => void }) {
  const t = useT('quality')
  const tc = useT('common')
  const msg = useQualityMessage()
  const { register, handleSubmit, formState } = useForm<
    z.input<typeof submitSchema>,
    unknown,
    z.output<typeof submitSchema>
  >({ resolver: zodResolver(submitSchema), defaultValues: { value: '' } })
  const save = useLabMutation(
    (value: number) => labApi.quality.submitEqa(row.id, value),
    {
      success: () => t('eqaSubmitted', { analyte: row.analyteName }),
      onSuccess: onClose,
    },
  )
  const submit = (v: z.output<typeof submitSchema>) =>
    save.mutate(parseDecimal(v.value) ?? 0)
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={t('eqaSubmitTitle')}
      description={t('eqaSubmitBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            <SendIcon />
            {t('eqaSubmit')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <RoundSummary row={row} />
        <Field
          label={
            row.unit
              ? t('eqaReportedUnit', { unit: row.unit })
              : t('eqaReported')
          }
          hint={t('eqaReportedHint')}
          required
          error={msg(formState.errors.value?.message)}
        >
          <Input
            {...register('value')}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            className="tabular-nums"
          />
        </Field>
      </form>
    </Dialog>
  )
}

const evaluateSchema = z.object({
  target: decimal,
  sd: decimal.refine((v) => (parseDecimal(v) ?? 0) > 0, 'forms.positive'),
})

function EvaluateDialog({
  row,
  onClose,
}: {
  row: EqaRow
  onClose: () => void
}) {
  const t = useT('quality')
  const tc = useT('common')
  const msg = useQualityMessage()
  const { register, handleSubmit, formState, control } = useForm<
    z.input<typeof evaluateSchema>,
    unknown,
    z.output<typeof evaluateSchema>
  >({
    resolver: zodResolver(evaluateSchema),
    defaultValues: { target: '', sd: '' },
  })
  const [target, sd] = useWatch({ control, name: ['target', 'sd'] })
  const targetValue = parseDecimal(target)
  const sdValue = parseDecimal(sd)
  const zScore =
    row.reportedValue !== undefined && targetValue !== null && sdValue !== null
      ? eqaZScore(row.reportedValue, targetValue, sdValue)
      : null
  const outcome = zScore === null ? null : eqaOutcome(zScore)
  const save = useLabMutation(
    (input: { targetValue: number; targetSd: number }) =>
      labApi.quality.evaluateEqa(row.id, input),
    {
      success: (result) =>
        result === 'unacceptable'
          ? {
              title: t('eqaEvaluated', { analyte: row.analyteName }),
              description: t('eqaNcRaised'),
            }
          : t('eqaEvaluated', { analyte: row.analyteName }),
      onSuccess: onClose,
    },
  )
  const submit = (v: z.output<typeof evaluateSchema>) =>
    save.mutate({
      targetValue: parseDecimal(v.target) ?? 0,
      targetSd: parseDecimal(v.sd) ?? 0,
    })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={t('eqaEvaluateTitle')}
      description={t('eqaEvaluateBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <GuardedButton
            permission="quality.manage"
            variant="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            <SigmaIcon />
            {t('eqaEvaluate')}
          </GuardedButton>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <RoundSummary row={row} />
        <p className="text-meta text-fg-muted">
          {t('eqaReportedWas', {
            value: `${row.reportedValue ?? '-'} ${row.unit}`.trim(),
          })}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('eqaAssigned')}
            required
            error={msg(formState.errors.target?.message)}
          >
            <Input
              {...register('target')}
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              className="tabular-nums"
            />
          </Field>
          <Field
            label={t('eqaSd')}
            required
            error={msg(formState.errors.sd?.message)}
          >
            <Input
              {...register('sd')}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
        </div>
        <div
          aria-live="polite"
          className="grid gap-2 rounded-xl border border-line bg-surface-2/60 p-3.5"
        >
          {zScore === null || outcome === null ? (
            <p className="text-meta text-fg-muted">{t('eqaZWaiting')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-meta text-fg-muted">{t('eqaZ')}</span>
              <span className="text-xl font-semibold text-fg tabular-nums">
                {signed(zScore)}
              </span>
              <EqaOutcomeBadge outcome={outcome} />
            </div>
          )}
          <p className="text-xs text-fg-subtle">{t('eqaZRule')}</p>
          {outcome === 'unacceptable' ? (
            <p className="flex gap-2 rounded-lg border border-danger-text/25 bg-danger-soft p-2.5 text-meta text-danger-text">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('eqaWillRaiseNc')}
            </p>
          ) : null}
        </div>
      </form>
    </Dialog>
  )
}

type Acting = { kind: 'submit' | 'evaluate'; row: EqaRow } | null

export function EqaPanel() {
  const t = useT('quality')
  const f = useFormat()
  const { data, isPending, isError, refetch } = useEqa()
  const [acting, setActing] = useState<Acting>(null)

  const columns: Column<EqaRow>[] = [
    {
      id: 'round',
      header: t('eqaRound'),
      sortValue: (r) => `${r.scheme} ${r.roundNo}`,
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-meta font-medium whitespace-nowrap text-fg">
            {r.scheme} {r.roundNo}
          </p>
          <p className="truncate text-xs text-fg-muted">{r.provider}</p>
        </div>
      ),
    },
    {
      id: 'analyte',
      header: t('eqaAnalyteAnalyser'),
      sortValue: (r) => r.analyteName,
      cell: (r) => (
        <div className="max-w-56 min-w-0">
          <p className="truncate text-meta text-fg">{r.analyteName}</p>
          {r.equipmentName ? (
            <p className="truncate text-xs text-fg-muted">{r.equipmentName}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'received',
      header: t('eqaReceived'),
      tabletHidden: true,
      sortValue: (r) => r.receivedAt,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {f.date(r.receivedAt)}
        </span>
      ),
    },
    {
      id: 'due',
      header: t('eqaDue'),
      sortValue: (r) => r.dueAt,
      cell: (r) => (
        <div className="grid gap-0.5">
          <span className="text-meta whitespace-nowrap text-fg">
            {f.date(r.dueAt)}
          </span>
          {r.overdue ? <OverdueText /> : null}
        </div>
      ),
    },
    {
      id: 'reported',
      header: t('eqaReported'),
      align: 'right',
      sortValue: (r) => r.reportedValue ?? null,
      cell: (r) =>
        r.reportedValue === undefined ? (
          <span className="text-meta whitespace-nowrap text-fg-subtle">
            {t('eqaNotSubmitted')}
          </span>
        ) : (
          <div className="grid justify-items-end gap-0.5">
            <span className="text-meta font-medium whitespace-nowrap text-fg tabular-nums">
              {r.reportedValue} {r.unit}
            </span>
            {r.submittedByName ? (
              <span className="text-xs whitespace-nowrap text-fg-subtle">
                {r.submittedByName}
              </span>
            ) : null}
          </div>
        ),
    },
    {
      id: 'assigned',
      header: t('eqaAssignedShort'),
      align: 'right',
      tabletHidden: true,
      cell: (r) =>
        r.targetValue === undefined ? (
          <span className="text-meta text-fg-subtle">-</span>
        ) : (
          <span className="text-meta whitespace-nowrap text-fg tabular-nums">
            {t('eqaAssignedValue', {
              value: r.targetValue,
              sd: r.targetSd ?? '-',
            })}
          </span>
        ),
    },
    {
      id: 'z',
      header: t('eqaZ'),
      align: 'right',
      sortValue: (r) => (r.zScore === undefined ? null : Math.abs(r.zScore)),
      cell: (r) => (
        <span className="text-meta font-medium whitespace-nowrap text-fg tabular-nums">
          {r.zScore === undefined ? '-' : signed(r.zScore)}
        </span>
      ),
    },
    {
      id: 'outcome',
      header: t('eqaOutcomeCol'),
      cell: (r) =>
        r.outcome ? (
          <div className="grid justify-items-start gap-1">
            <EqaOutcomeBadge outcome={r.outcome} />
            {r.ncId && r.ncNo ? (
              <Link
                to={`/quality?tab=capa&nc=${encodeURIComponent(r.ncId)}`}
                className="focus-ring rounded py-0.5 font-mono text-xs font-medium whitespace-nowrap text-accent-text hover:underline"
              >
                {r.ncNo}
              </Link>
            ) : null}
          </div>
        ) : (
          <span className="text-meta whitespace-nowrap text-fg-subtle">
            {r.submittedAt
              ? t('eqaAwaitingEvaluation')
              : t('eqaAwaitingResult')}
          </span>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('actions')}</span>,
      cell: (r) =>
        !r.submittedAt ? (
          <GuardedButton
            permission="quality.record"
            size="xs"
            onClick={() => setActing({ kind: 'submit', row: r })}
          >
            <SendIcon />
            {t('eqaSubmit')}
            <span className="sr-only">: {r.analyteName}</span>
          </GuardedButton>
        ) : !r.evaluatedAt ? (
          <GuardedButton
            permission="quality.manage"
            size="xs"
            onClick={() => setActing({ kind: 'evaluate', row: r })}
          >
            <SigmaIcon />
            {t('eqaEvaluate')}
            <span className="sr-only">: {r.analyteName}</span>
          </GuardedButton>
        ) : null,
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<TargetIcon />}
        tone="amber"
        title={t('eqaTitle')}
        description={t('eqaDescription')}
      />
      <DataTable
        caption={t('eqaTitle')}
        columns={columns}
        rows={data}
        getRowId={(r) => r.id}
        isLoading={isPending}
        isError={isError}
        onRetry={() => void refetch()}
        pageSize={50}
        rowClassName={(r) => (r.overdue ? 'row-alert' : undefined)}
        mobile={{
          primary: 'round',
          fields: ['analyte', 'due', 'reported', 'outcome'],
          actions: 'actions',
        }}
        empty={
          <EmptyState
            icon={<TargetIcon />}
            tone="amber"
            title={t('eqaEmpty')}
            description={t('eqaEmptyBody')}
          />
        }
      />
      {acting?.kind === 'submit' ? (
        <SubmitDialog row={acting.row} onClose={() => setActing(null)} />
      ) : null}
      {acting?.kind === 'evaluate' ? (
        <EvaluateDialog row={acting.row} onClose={() => setActing(null)} />
      ) : null}
    </Card>
  )
}
