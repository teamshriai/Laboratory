import { zodResolver } from '@hookform/resolvers/zod'
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  SaveIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { istDay } from '@/domain/time'
import { QUALIFICATION_KINDS, type QualificationKind } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi, type QualificationRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useQualifications } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Segmented } from '@/components/ui/toggles'

function OutcomeBadge({ outcome }: { outcome: QualificationRow['outcome'] }) {
  const t = useT('coldStorage')
  return outcome === 'pass' ? (
    <Badge tone="success" size="sm">
      <CircleCheckIcon aria-hidden />
      {t('qualPass')}
    </Badge>
  ) : (
    <Badge tone="danger" size="sm">
      <CircleXIcon aria-hidden />
      {t('qualFail')}
    </Badge>
  )
}

const schema = z.object({
  kind: z.enum(QUALIFICATION_KINDS, { message: 'forms.selectOne' }),
  outcome: z.enum(['pass', 'fail']),
  reference: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .max(120, 'forms.invalid'),
  date: z
    .string()
    .min(1, 'forms.required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'forms.invalidDate'),
  note: z.string().max(500, 'forms.invalid'),
})

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

/** Records an IQ, OQ or PQ; the date may not be in the future. */
function RecordQualificationDialog({
  equipmentId,
  equipmentName,
  initialKind,
  onClose,
}: {
  equipmentId: string
  equipmentName: string
  initialKind: QualificationKind
  onClose: () => void
}) {
  const t = useT('coldStorage')
  const tc = useT('common')
  const now = useNow()
  const today = istDay(now)
  const { register, control, handleSubmit, formState, setError } = useForm<
    FormIn,
    unknown,
    FormOut
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: initialKind,
      outcome: 'pass',
      reference: '',
      date: today,
      note: '',
    },
  })
  const outcome = useWatch({ control, name: 'outcome' })

  const save = useLabMutation(
    (v: FormOut) => {
      const note = v.note.trim()
      // Today is recorded as now; an earlier day at noon IST.
      const at =
        v.date === today ? undefined : Date.parse(`${v.date}T12:00:00+05:30`)
      return labApi.quality.recordQualification({
        equipmentId,
        kind: v.kind,
        outcome: v.outcome,
        reference: v.reference,
        ...(at !== undefined ? { at } : {}),
        ...(note ? { note } : {}),
      })
    },
    {
      success: (_, v) =>
        t('qualRecordedToast', {
          kind: t(`qualShort.${v.kind}`),
          name: equipmentName,
        }),
      onSuccess: onClose,
    },
  )

  const submit = (ev?: React.BaseSyntheticEvent) =>
    void handleSubmit((v) => {
      if (v.date > today || Number.isNaN(Date.parse(v.date))) {
        setError(
          'date',
          {
            message: v.date > today ? 'forms.futureDate' : 'forms.invalidDate',
          },
          { shouldFocus: true },
        )
        return
      }
      save.mutate(v)
    }, focusInvalid)(ev)

  return (
    <Dialog
      open
      size="md"
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={t('recordQualification')}
      description={equipmentName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => submit()}
          >
            <SaveIcon />
            {t('recordQualification')}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(formState.errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Field
          label={t('qualKind')}
          required
          error={formState.errors.kind?.message}
        >
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Segmented
                value={field.value}
                onValueChange={field.onChange}
                aria-label={t('qualKind')}
                className="w-full [&>*]:flex-1"
                options={QUALIFICATION_KINDS.map((k) => ({
                  value: k,
                  label: (
                    <>
                      <span aria-hidden className="sm:hidden">
                        {t(`qualShort.${k}`)}
                      </span>
                      <span className="max-sm:sr-only">
                        {t(`qualKind.${k}`)}
                      </span>
                    </>
                  ),
                }))}
              />
            )}
          />
        </Field>
        <Field label={t('qualOutcome')} required>
          <Controller
            control={control}
            name="outcome"
            render={({ field }) => (
              <Segmented
                value={field.value}
                onValueChange={field.onChange}
                aria-label={t('qualOutcome')}
                className="w-full [&>*]:flex-1"
                options={[
                  {
                    value: 'pass' as const,
                    label: t('qualPass'),
                    icon: <CircleCheckIcon />,
                  },
                  {
                    value: 'fail' as const,
                    label: t('qualFail'),
                    icon: <CircleXIcon />,
                  },
                ]}
              />
            )}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <Field
            label={t('qualReference')}
            required
            error={formState.errors.reference?.message}
          >
            <Input
              {...register('reference')}
              maxLength={120}
              autoComplete="off"
              placeholder={t('qualReferencePlaceholder')}
            />
          </Field>
          <Field
            label={t('qualDate')}
            required
            error={formState.errors.date?.message}
          >
            <Input type="date" {...register('date')} max={today} />
          </Field>
        </div>
        <Field
          label={t('qualNote')}
          optionalLabel={tc('optional')}
          {...(outcome === 'fail' ? { hint: t('qualFailNotice') } : {})}
          error={formState.errors.note?.message}
        >
          <Textarea
            {...register('note')}
            rows={3}
            maxLength={500}
            placeholder={t('qualNotePlaceholder')}
          />
        </Field>
      </form>
    </Dialog>
  )
}

/** The equipment's IQ / OQ / PQ records and a way to add one. */
export function QualificationSection({
  equipmentId,
  equipmentName,
}: {
  equipmentId: string
  equipmentName: string
}) {
  const t = useT('coldStorage')
  const f = useFormat()
  const { data, isPending, isError, refetch } = useQualifications(equipmentId)
  const [recording, setRecording] = useState<QualificationKind | null>(null)
  // Newest first from the API, so the first of each kind is the latest.
  const latest = (kind: QualificationKind) => data?.find((q) => q.kind === kind)
  const nextKind =
    QUALIFICATION_KINDS.find((k) => !latest(k)) ?? QUALIFICATION_KINDS[0]

  return (
    <section aria-labelledby={`qual-${equipmentId}`} className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            id={`qual-${equipmentId}`}
            className="text-sm font-semibold text-fg"
          >
            {t('qualTitle')}
          </h3>
          <p className="text-xs text-fg-muted">{t('qualDescription')}</p>
        </div>
        <GuardedButton
          permission="equipment.manage"
          size="sm"
          variant="secondary"
          onClick={() => setRecording(nextKind)}
        >
          <ClipboardCheckIcon />
          {t('recordQualification')}
        </GuardedButton>
      </div>

      {isError ? (
        <ErrorState compact onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
            {QUALIFICATION_KINDS.map((k) => {
              const q = latest(k)
              return (
                <div
                  key={k}
                  className="min-w-0 rounded-xl border border-line px-3 py-2.5"
                >
                  <dt className="text-xs text-fg-muted">
                    {t(`qualKind.${k}`)}
                  </dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {q ? (
                      <>
                        <OutcomeBadge outcome={q.outcome} />
                        <span className="text-xs text-fg-muted tabular-nums">
                          {f.date(q.at)}
                        </span>
                      </>
                    ) : (
                      <Badge tone="neutral" size="sm">
                        <CircleDashedIcon aria-hidden />
                        {t('qualNotRecorded')}
                      </Badge>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
          {data.length === 0 ? (
            <EmptyState
              compact
              icon={<ClipboardCheckIcon />}
              tone="teal"
              title={t('qualEmptyTitle')}
              description={t('qualEmptyBody')}
            />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {data.map((q) => (
                <li key={q.id} className="grid gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-meta font-medium text-fg">
                      {t(`qualKind.${q.kind}`)}
                    </span>
                    <OutcomeBadge outcome={q.outcome} />
                    <span className="ml-auto text-xs whitespace-nowrap text-fg-muted tabular-nums">
                      {f.date(q.at)}
                    </span>
                  </div>
                  <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                    <span>
                      {t('qualReference')}:{' '}
                      <span className="font-mono text-fg">{q.reference}</span>
                    </span>
                    <span>
                      {t('qualBy')}: {q.byName}
                    </span>
                  </p>
                  {q.note ? (
                    <p className="text-xs text-fg-muted">{q.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {recording ? (
        <RecordQualificationDialog
          equipmentId={equipmentId}
          equipmentName={equipmentName}
          initialKind={recording}
          onClose={() => setRecording(null)}
        />
      ) : null}
    </section>
  )
}
