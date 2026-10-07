import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { DEPARTMENTS, NC_SEVERITIES, NC_SOURCES } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi, type NcInput } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ChoiceCards } from '@/components/ui/toggles'
import { useQualityMessage } from './quality'

const DEPARTMENT_CHOICES = ['all', ...DEPARTMENTS] as const

const schema = z.object({
  title: z.string().trim().min(3, 'forms.required').max(200, 'forms.invalid'),
  source: z.enum(NC_SOURCES, { error: 'forms.selectOne' }),
  severity: z.enum(NC_SEVERITIES, { error: 'forms.selectOne' }),
  department: z.enum(DEPARTMENT_CHOICES, { error: 'forms.selectOne' }),
  description: z
    .string()
    .trim()
    .min(3, 'forms.required')
    .max(2000, 'forms.invalid'),
})
type Values = z.input<typeof schema>

export function RaiseNcDialog({
  onClose,
  onRaised,
}: {
  onClose: () => void
  onRaised: (id: string) => void
}) {
  const t = useT('quality')
  const tc = useT('common')
  const e = useEnum()
  const msg = useQualityMessage()
  const { register, control, handleSubmit, formState } = useForm<
    Values,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      severity: 'minor',
      department: 'all',
      description: '',
    },
  })
  const save = useLabMutation(
    (input: NcInput) => labApi.quality.raiseNc(input),
    {
      success: () => t('ncRaised'),
      onSuccess: (id) => onRaised(id),
    },
  )
  const submit = (v: z.output<typeof schema>) =>
    save.mutate({
      title: v.title,
      source: v.source,
      severity: v.severity,
      department: v.department,
      description: v.description,
    })
  const errors = formState.errors
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="lg"
      title={t('raiseNcTitle')}
      description={t('raiseNcBody')}
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
            {t('raiseNc')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Field
          label={t('ncTitleField')}
          hint={t('ncTitleHint')}
          required
          error={msg(errors.title?.message)}
        >
          <Input {...register('title')} maxLength={200} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('ncSourceField')}
            required
            error={msg(errors.source?.message)}
          >
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={tc('selectPlaceholder')}
                  options={NC_SOURCES.map((s) => ({
                    value: s,
                    label: t(`ncSource.${s}`),
                  }))}
                />
              )}
            />
          </Field>
          <Field
            label={t('department')}
            required
            error={msg(errors.department?.message)}
          >
            <Controller
              control={control}
              name="department"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={DEPARTMENT_CHOICES.map((d) => ({
                    value: d,
                    label:
                      d === 'all' ? t('allDepartments') : e('department', d),
                  }))}
                />
              )}
            />
          </Field>
        </div>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-fg-muted">
            {t('ncSeverityField')}
          </legend>
          <Controller
            control={control}
            name="severity"
            render={({ field }) => (
              <ChoiceCards
                value={field.value}
                onValueChange={field.onChange}
                aria-label={t('ncSeverityField')}
                options={NC_SEVERITIES.map((s) => ({
                  value: s,
                  label: t(`ncSeverity.${s}`),
                  description: t(`ncSeverityHint.${s}`),
                }))}
              />
            )}
          />
        </fieldset>
        <Field
          label={t('ncDescriptionField')}
          hint={t('ncDescriptionHint')}
          required
          error={msg(errors.description?.message)}
        >
          <Textarea {...register('description')} rows={4} maxLength={2000} />
        </Field>
        <p className="text-xs text-fg-subtle">{t('raiseNcNext')}</p>
      </form>
    </Dialog>
  )
}
