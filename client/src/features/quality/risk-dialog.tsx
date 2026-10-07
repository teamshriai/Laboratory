import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { riskLevel } from '@/domain/quality'
import { RISK_STATES } from '@/domain/types'
import { useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi, type RiskInput, type RiskRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  endOfIstDate,
  RISK_RATINGS,
  toDateInput,
  useQualityMessage,
  useStaffOptions,
} from './quality'
import { RiskLevelBadge } from './quality-badges'

const text = (max: number) =>
  z.string().trim().min(3, 'forms.required').max(max, 'forms.invalid')
const rating = z.enum(RISK_RATINGS, { error: 'forms.selectOne' })

const schema = z.object({
  title: text(200),
  process: text(200),
  hazard: text(2000),
  likelihood: rating,
  severity: rating,
  controls: text(2000),
  residualLikelihood: rating,
  residualSeverity: rating,
  ownerId: z.string().min(1, 'forms.selectOne'),
  reviewDue: z
    .string()
    .refine((v) => endOfIstDate(v) !== null, 'forms.invalidDate'),
  state: z.enum(RISK_STATES),
})
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

function ScoreLine({
  control,
  likelihood,
  severity,
}: {
  control: Control<FormIn, unknown, FormOut>
  likelihood: 'likelihood' | 'residualLikelihood'
  severity: 'severity' | 'residualSeverity'
}) {
  const t = useT('quality')
  const [l, s] = useWatch({ control, name: [likelihood, severity] })
  if (!l || !s) return null
  const score = Number(l) * Number(s)
  return (
    <p
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 text-meta text-fg-muted sm:col-span-2"
    >
      {t('riskScoreLine', { l, s, score })}
      <RiskLevelBadge level={riskLevel(score)} />
    </p>
  )
}

export function RiskDialog({
  risk,
  onClose,
}: {
  risk?: RiskRow | undefined
  onClose: () => void
}) {
  const t = useT('quality')
  const tc = useT('common')
  const msg = useQualityMessage()
  const owners = useStaffOptions()
  const asRating = (n: number | undefined) =>
    n === undefined ? undefined : (String(n) as (typeof RISK_RATINGS)[number])
  const { register, control, handleSubmit, formState } = useForm<
    FormIn,
    unknown,
    FormOut
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      title: risk?.title ?? '',
      process: risk?.process ?? '',
      hazard: risk?.hazard ?? '',
      likelihood: asRating(risk?.likelihood),
      severity: asRating(risk?.severity),
      controls: risk?.controls ?? '',
      residualLikelihood: asRating(risk?.residualLikelihood),
      residualSeverity: asRating(risk?.residualSeverity),
      ownerId: risk?.ownerId ?? '',
      reviewDue: risk ? toDateInput(risk.reviewDueAt) : '',
      state: risk?.state ?? 'open',
    },
  })
  const save = useLabMutation(
    (input: RiskInput) => labApi.quality.saveRisk(input),
    {
      success: (_, v) =>
        t(risk ? 'riskUpdated' : 'riskAdded', { title: v.title }),
      onSuccess: onClose,
    },
  )
  const submit = (v: FormOut) =>
    save.mutate({
      ...(risk ? { id: risk.id } : {}),
      title: v.title,
      process: v.process,
      hazard: v.hazard,
      likelihood: Number(v.likelihood),
      severity: Number(v.severity),
      controls: v.controls,
      residualLikelihood: Number(v.residualLikelihood),
      residualSeverity: Number(v.residualSeverity),
      ownerId: v.ownerId,
      reviewDueAt: endOfIstDate(v.reviewDue) ?? 0,
      state: v.state,
    })
  const errors = formState.errors
  const ratingSelect = (
    name: 'likelihood' | 'severity' | 'residualLikelihood' | 'residualSeverity',
    scale: 'likelihoodScale' | 'severityScale',
    label: string,
  ) => (
    <Field label={label} required error={msg(errors[name]?.message)}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            placeholder={tc('selectPlaceholder')}
            options={RISK_RATINGS.map((r) => ({
              value: r,
              label: t(`${scale}.${r}`),
            }))}
          />
        )}
      />
    </Field>
  )
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="lg"
      title={risk ? t('riskEditTitle', { no: risk.riskNo }) : t('riskAddTitle')}
      description={t('riskDialogBody')}
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
            {tc('save')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('riskTitleField')}
            required
            error={msg(errors.title?.message)}
          >
            <Input {...register('title')} maxLength={200} autoComplete="off" />
          </Field>
          <Field
            label={t('riskProcess')}
            hint={t('riskProcessHint')}
            required
            error={msg(errors.process?.message)}
          >
            <Input
              {...register('process')}
              maxLength={200}
              autoComplete="off"
            />
          </Field>
        </div>
        <Field
          label={t('riskHazard')}
          hint={t('riskHazardHint')}
          required
          error={msg(errors.hazard?.message)}
        >
          <Textarea {...register('hazard')} rows={2} maxLength={2000} />
        </Field>
        <fieldset className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-fg">
            {t('riskInherent')}
          </legend>
          {ratingSelect('likelihood', 'likelihoodScale', t('riskLikelihood'))}
          {ratingSelect('severity', 'severityScale', t('riskSeverity'))}
          <ScoreLine
            control={control}
            likelihood="likelihood"
            severity="severity"
          />
        </fieldset>
        <Field
          label={t('riskControls')}
          hint={t('riskControlsHint')}
          required
          error={msg(errors.controls?.message)}
        >
          <Textarea {...register('controls')} rows={2} maxLength={2000} />
        </Field>
        <fieldset className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-fg">
            {t('riskResidual')}
          </legend>
          {ratingSelect(
            'residualLikelihood',
            'likelihoodScale',
            t('riskLikelihood'),
          )}
          {ratingSelect('residualSeverity', 'severityScale', t('riskSeverity'))}
          <ScoreLine
            control={control}
            likelihood="residualLikelihood"
            severity="residualSeverity"
          />
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t('riskOwner')}
            required
            error={msg(errors.ownerId?.message)}
          >
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => (
                <Combobox
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  options={owners}
                  placeholder={tc('selectPlaceholder')}
                  searchPlaceholder={t('searchStaff')}
                  emptyText={t('noStaff')}
                />
              )}
            />
          </Field>
          <Field
            label={t('riskReviewDue')}
            required
            error={msg(errors.reviewDue?.message)}
          >
            <Input
              {...register('reviewDue')}
              type="date"
              className="tabular-nums"
            />
          </Field>
          <Field label={t('stateCol')} error={msg(errors.state?.message)}>
            <Controller
              control={control}
              name="state"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={RISK_STATES.map((s) => ({
                    value: s,
                    label: t(`riskState.${s}`),
                  }))}
                />
              )}
            />
          </Field>
        </div>
      </form>
    </Dialog>
  )
}
