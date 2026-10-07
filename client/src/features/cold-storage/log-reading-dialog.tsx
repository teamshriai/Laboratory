import { zodResolver } from '@hookform/resolvers/zod'
import { SaveIcon, TriangleAlertIcon, CircleCheckIcon } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { isTemperatureInRange } from '@/domain/quality'
import { useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { isLabApiError, labApi, type ColdUnitRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import {
  TEMPERATURE_LIMITS,
  parseNumber,
  useColdText,
  useTemperature,
} from './cold-utils'

const ACTION_REQUIRED = 'coldStorage.actionRequired'
const IMPLAUSIBLE = 'coldStorage.implausible'

function schemaFor(min: number, max: number) {
  return z
    .object({
      value: z
        .string()
        .trim()
        .min(1, 'forms.required')
        .refine((v) => parseNumber(v) !== null, 'forms.invalidNumber')
        .refine((v) => {
          const n = parseNumber(v)
          return (
            n === null ||
            (n >= TEMPERATURE_LIMITS.min && n <= TEMPERATURE_LIMITS.max)
          )
        }, IMPLAUSIBLE),
      action: z.string().max(500, 'forms.invalid'),
    })
    .superRefine((v, ctx) => {
      const n = parseNumber(v.value)
      if (n !== null && !isTemperatureInRange(n, min, max) && !v.action.trim())
        ctx.addIssue({
          code: 'custom',
          path: ['action'],
          message: ACTION_REQUIRED,
        })
    })
}

type Schema = ReturnType<typeof schemaFor>
type FormIn = z.input<Schema>
type FormOut = z.output<Schema>

/** Logs one temperature; an out-of-range value needs the action taken. */
export function LogReadingDialog({
  unit,
  onClose,
}: {
  unit: ColdUnitRow
  onClose: () => void
}) {
  const t = useT('coldStorage')
  const tc = useT('common')
  const text = useColdText()
  const temp = useTemperature()
  const range = temp.range(unit.min, unit.max)
  const { register, control, handleSubmit, formState, setError } = useForm<
    FormIn,
    unknown,
    FormOut
  >({
    resolver: zodResolver(schemaFor(unit.min, unit.max)),
    defaultValues: { value: '', action: '' },
  })
  const typed = useWatch({ control, name: 'value' })
  const value = parseNumber(typed ?? '')
  const plausible =
    value !== null &&
    value >= TEMPERATURE_LIMITS.min &&
    value <= TEMPERATURE_LIMITS.max
  const outOfRange =
    plausible && !isTemperatureInRange(value, unit.min, unit.max)

  const save = useLabMutation(
    (v: { value: number; action?: string }) =>
      labApi.quality.recordTemperature(unit.id, v),
    {
      success: (_, v) =>
        isTemperatureInRange(v.value, unit.min, unit.max)
          ? t('loggedToast', { name: unit.name })
          : t('loggedOutToast', { name: unit.name }),
      onSuccess: onClose,
      onError: (error) => {
        if (!isLabApiError(error)) return
        if (error.code === 'action-required')
          setError(
            'action',
            { message: ACTION_REQUIRED },
            { shouldFocus: true },
          )
        if (error.code === 'implausible-value')
          setError('value', { message: IMPLAUSIBLE }, { shouldFocus: true })
      },
    },
  )

  const submit = (ev?: React.BaseSyntheticEvent) =>
    void handleSubmit((v) => {
      const n = parseNumber(v.value)
      if (n === null) return
      const action = v.action.trim()
      save.mutate({ value: n, ...(action ? { action } : {}) })
    }, focusInvalid)(ev)

  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={t('logTitle')}
      description={t('logDescription', { name: unit.name, range })}
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
            {t('logReading')}
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
          label={t('fieldValue')}
          required
          hint={t('valueHint')}
          error={text(formState.errors.value?.message)}
        >
          <Input
            {...register('value')}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            className="text-lg tabular-nums"
          />
        </Field>

        <div aria-live="polite">
          {outOfRange ? (
            <div className="flex gap-2.5 rounded-lg border border-danger-text/25 bg-danger-soft px-3 py-2.5 text-meta text-danger-text">
              <TriangleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <div>
                <p className="font-semibold">{t('outOfRangeTitle')}</p>
                <p className="mt-0.5">
                  {t('outOfRangeBody', { value: temp.temp(value), range })}
                </p>
              </div>
            </div>
          ) : plausible ? (
            <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-meta text-success-text">
              <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
              {t('inRangePreview', { value: temp.temp(value) })}
            </p>
          ) : null}
        </div>

        <Field
          label={t('fieldAction')}
          required={outOfRange}
          optionalLabel={outOfRange ? undefined : tc('optional')}
          error={text(formState.errors.action?.message)}
        >
          <Textarea
            {...register('action')}
            rows={3}
            maxLength={500}
            placeholder={t('actionPlaceholder')}
          />
        </Field>
      </form>
    </Dialog>
  )
}
