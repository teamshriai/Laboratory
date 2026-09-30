import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  BLOOD_GROUPS,
  CLINICAL_DEPARTMENTS,
  ENCOUNTER_TYPES,
  SEXES,
} from '@/domain/types'
import { istDay } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/toggles'

const schema = z.object({
  name: z.string().trim().min(2, 'forms.required').max(80, 'forms.tooLong'),
  nameLocal: z.string().trim().max(80, 'forms.tooLong'),
  sex: z.enum(SEXES),
  dob: z
    .string()
    .min(1, 'forms.required')
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && Date.parse(v) <= Date.now(),
      'forms.invalidDate',
    ),
  mobile: z
    .string()
    .refine(
      (v) =>
        /^\d{10}$/.test(v.replace(/\D/g, '').slice(-10)) &&
        v.replace(/\D/g, '').length >= 10,
      'forms.invalidMobile',
    ),
  email: z.union([z.literal(''), z.email('forms.invalidEmail')]),
  bloodGroup: z.union([z.literal('unknown'), z.enum(BLOOD_GROUPS)]),
  allergies: z.string().max(200, 'forms.tooLong'),
  city: z.string().trim().min(1, 'forms.required'),
  state: z.string().trim().min(1, 'forms.required'),
  encounter: z.enum(ENCOUNTER_TYPES),
  department: z.enum(CLINICAL_DEPARTMENTS),
})

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

function detectLang(text: string) {
  if (/[ಀ-೿]/.test(text)) return 'kn' as const
  if (/[஀-௿]/.test(text)) return 'ta' as const
  if (/[ഀ-ൿ]/.test(text)) return 'ml' as const
  if (/[ऀ-ॿ]/.test(text)) return 'hi' as const
  return null
}

export function RegisterPatientDialog({
  open,
  onOpenChange,
  onRegistered,
  initialName = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegistered: (patient: { id: string; uhid: string; name: string }) => void
  initialName?: string
}) {
  const t = useT('orders')
  const tc = useT('common')
  const e = useEnum()
  const now = useNow()
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialName,
      nameLocal: '',
      sex: 'F',
      dob: '',
      mobile: '',
      email: '',
      bloodGroup: 'unknown',
      allergies: '',
      city: 'Bengaluru',
      state: 'Karnataka',
      encounter: 'OPD',
      department: 'general-medicine',
    },
  })
  const { register, control, handleSubmit, formState } = form
  const err = (k: keyof FormIn) => formState.errors[k]?.message

  const mutation = useLabMutation(
    (v: FormOut) => {
      const digits = v.mobile.replace(/\D/g, '').slice(-10)
      const lang = detectLang(v.nameLocal)
      return labApi.patients
        .register({
          name: v.name,
          sex: v.sex,
          dob: v.dob,
          mobile: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
          allergies: v.allergies
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          city: v.city,
          state: v.state,
          encounter: { type: v.encounter, department: v.department },
          ...(v.email ? { email: v.email } : {}),
          ...(v.bloodGroup !== 'unknown' ? { bloodGroup: v.bloodGroup } : {}),
          ...(v.nameLocal && lang
            ? { nameLocal: { lang, text: v.nameLocal } }
            : {}),
        })
        .then((r) => ({ ...r, name: v.name }))
    },
    {
      success: (r) => t('patientRegistered', { name: r.name, uhid: r.uhid }),
      onSuccess: (r) => {
        form.reset()
        onRegistered(r)
        onOpenChange(false)
      },
    },
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('registerTitle')}
      description={t('registerDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => void handleSubmit((v) => mutation.mutate(v))()}
          >
            {t('register')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(ev) => void handleSubmit((v) => mutation.mutate(v))(ev)}
        noValidate
      >
        <Field
          label={t('fullName')}
          required
          error={err('name')}
          className="sm:col-span-2"
        >
          <Input {...register('name')} autoComplete="off" autoFocus />
        </Field>
        <Field
          label={t('nameLocal')}
          hint={t('nameLocalHint')}
          optionalLabel={tc('optional')}
          error={err('nameLocal')}
          className="sm:col-span-2"
        >
          <Input {...register('nameLocal')} autoComplete="off" />
        </Field>
        <Field label={t('sex')} required>
          <Controller
            control={control}
            name="sex"
            render={({ field }) => (
              <Segmented
                value={field.value}
                onValueChange={field.onChange}
                options={SEXES.map((s) => ({ value: s, label: e('sex', s) }))}
                className="w-full [&>*]:flex-1 [&>*]:justify-center"
              />
            )}
          />
        </Field>
        <Field label={t('dateOfBirth')} required error={err('dob')}>
          <Input type="date" {...register('dob')} max={istDay(now)} />
        </Field>
        <Field label={t('mobile')} required error={err('mobile')}>
          <Input
            {...register('mobile')}
            inputMode="tel"
            placeholder="98450 12345"
            autoComplete="off"
          />
        </Field>
        <Field
          label={t('email')}
          optionalLabel={tc('optional')}
          error={err('email')}
        >
          <Input type="email" {...register('email')} autoComplete="off" />
        </Field>
        <Field label={t('bloodGroup')}>
          <Controller
            control={control}
            name="bloodGroup"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={[
                  { value: 'unknown', label: t('unknown') },
                  ...BLOOD_GROUPS.map((b) => ({ value: b, label: b })),
                ]}
              />
            )}
          />
        </Field>
        <Field
          label={t('allergies')}
          hint={t('allergiesHint')}
          optionalLabel={tc('optional')}
          error={err('allergies')}
        >
          <Input {...register('allergies')} autoComplete="off" />
        </Field>
        <Field label={t('encounter')} required>
          <Controller
            control={control}
            name="encounter"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={ENCOUNTER_TYPES.map((x) => ({
                  value: x,
                  label: e('encounter', x),
                }))}
              />
            )}
          />
        </Field>
        <Field label={t('clinicalDepartment')} required>
          <Controller
            control={control}
            name="department"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={CLINICAL_DEPARTMENTS.map((x) => ({
                  value: x,
                  label: e('clinicalDepartment', x),
                }))}
              />
            )}
          />
        </Field>
        <Field label={t('city')} required error={err('city')}>
          <Input {...register('city')} />
        </Field>
        <Field label={t('state')} required error={err('state')}>
          <Input {...register('state')} />
        </Field>
      </form>
    </Dialog>
  )
}
