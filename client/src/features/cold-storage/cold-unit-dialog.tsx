import { zodResolver } from '@hookform/resolvers/zod'
import { SaveIcon } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { COLD_UNIT_KINDS, DEPARTMENTS } from '@/domain/types'
import { useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi, type ColdUnitRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  TEMPERATURE_LIMITS,
  parseNumber,
  useColdText,
  useTemperature,
} from './cold-utils'

const temperature = z
  .string()
  .trim()
  .min(1, 'forms.required')
  .refine((v) => parseNumber(v) !== null, 'forms.invalidNumber')
  .refine((v) => {
    const n = parseNumber(v)
    return (
      n === null || (n >= TEMPERATURE_LIMITS.min && n <= TEMPERATURE_LIMITS.max)
    )
  }, 'coldStorage.implausible')

const schema = z
  .object({
    name: z.string().trim().min(1, 'forms.required').max(120, 'forms.invalid'),
    kind: z.enum(COLD_UNIT_KINDS, { message: 'forms.selectOne' }),
    location: z
      .string()
      .trim()
      .min(1, 'forms.required')
      .max(120, 'forms.invalid'),
    department: z.enum(['all', ...DEPARTMENTS], { message: 'forms.selectOne' }),
    min: temperature,
    max: temperature,
  })
  .superRefine((v, ctx) => {
    const min = parseNumber(v.min)
    const max = parseNumber(v.max)
    if (min !== null && max !== null && min >= max)
      ctx.addIssue({
        code: 'custom',
        path: ['max'],
        message: 'coldStorage.rangeOrder',
      })
  })

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

/** Adds a cold storage unit or edits one (name, place and allowed range). */
export function ColdUnitDialog({
  unit,
  onClose,
}: {
  unit?: ColdUnitRow | undefined
  onClose: () => void
}) {
  const t = useT('coldStorage')
  const tc = useT('common')
  const text = useColdText()
  const temp = useTemperature()
  const { register, control, handleSubmit, formState } = useForm<
    FormIn,
    unknown,
    FormOut
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      name: unit?.name ?? '',
      kind: unit?.kind ?? 'refrigerator',
      location: unit?.location ?? '',
      department: unit?.department ?? 'all',
      min: unit ? String(unit.min) : '2',
      max: unit ? String(unit.max) : '8',
    },
  })
  const err = (k: keyof FormIn) => text(formState.errors[k]?.message)

  const save = useLabMutation(
    (v: FormOut) =>
      labApi.quality.saveColdUnit({
        ...(unit ? { id: unit.id } : {}),
        name: v.name,
        kind: v.kind,
        location: v.location,
        department: v.department,
        min: parseNumber(v.min) ?? 0,
        max: parseNumber(v.max) ?? 0,
      }),
    {
      success: (_, v) =>
        unit
          ? t('updatedToast', { name: v.name })
          : t('addedToast', { name: v.name }),
      onSuccess: onClose,
    },
  )
  const submit = (ev?: React.BaseSyntheticEvent) =>
    void handleSubmit((v) => save.mutate(v), focusInvalid)(ev)

  return (
    <Dialog
      open
      size="md"
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={unit ? t('editTitle', { name: unit.name }) : t('addTitle')}
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
            {t('saveUnit')}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(formState.errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Field label={t('fieldName')} required error={err('name')}>
          <Input
            {...register('name')}
            maxLength={120}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fieldKind')} required error={err('kind')}>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={COLD_UNIT_KINDS.map((k) => ({
                    value: k,
                    label: t(`kind.${k}`),
                  }))}
                />
              )}
            />
          </Field>
          <Field
            label={t('fieldDepartment')}
            required
            error={err('department')}
          >
            <Controller
              control={control}
              name="department"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={(['all', ...DEPARTMENTS] as const).map((d) => ({
                    value: d,
                    label: temp.department(d),
                  }))}
                />
              )}
            />
          </Field>
        </div>
        <Field label={t('fieldLocation')} required error={err('location')}>
          <Input {...register('location')} maxLength={120} autoComplete="off" />
        </Field>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">{t('colRange')}</legend>
          <Field label={t('fieldMin')} required error={err('min')}>
            <Input
              {...register('min')}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
          <Field
            label={t('fieldMax')}
            required
            hint={t('rangeHint')}
            error={err('max')}
          >
            <Input
              {...register('max')}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
        </fieldset>
      </form>
    </Dialog>
  )
}
