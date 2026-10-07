import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { normaliseIndianMobile } from '@/domain/collection'
import { CLINICAL_DEPARTMENTS, type Doctor } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SwitchRow } from './switch-row'

const schema = z.object({
  name: z.string().trim().min(1, 'forms.required'),
  department: z.enum(CLINICAL_DEPARTMENTS, { message: 'forms.selectOne' }),
  specialty: z.string().trim(),
  qualification: z.string().trim(),
  registrationNo: z.string().trim(),
  phone: z
    .string()
    .trim()
    .refine((v) => Boolean(normaliseIndianMobile(v)), 'errors.invalid-mobile'),
  email: z
    .string()
    .trim()
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'forms.invalidEmail'),
  external: z.boolean(),
  clinic: z.string().trim(),
  active: z.boolean(),
})

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

/** Adds a referring doctor or edits one (deactivating keeps their history). */
export function DoctorDialog({
  doctor,
  onClose,
}: {
  doctor?: Doctor | undefined
  onClose: () => void
}) {
  const t = useT('network')
  const tc = useT('common')
  const e = useEnum()
  const { register, control, handleSubmit, formState } = useForm<
    FormIn,
    unknown,
    FormOut
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      name: doctor?.name ?? '',
      department: doctor?.department ?? 'general-medicine',
      specialty: doctor?.specialty ?? '',
      qualification: doctor?.qualification ?? '',
      registrationNo: doctor?.registrationNo ?? '',
      phone: doctor?.phone ?? '',
      email: doctor?.email ?? '',
      external: Boolean(doctor?.external),
      clinic: doctor?.clinic ?? '',
      active: doctor?.active !== false,
    },
  })
  const external = useWatch({ control, name: 'external' })
  const err = (k: keyof FormIn) => formState.errors[k]?.message
  const save = useLabMutation(
    (v: FormOut) =>
      labApi.network.saveDoctor({
        ...(doctor ? { id: doctor.id } : {}),
        name: v.name,
        department: v.department,
        qualification: v.qualification,
        phone: v.phone,
        ...(v.specialty ? { specialty: v.specialty } : {}),
        ...(v.registrationNo ? { registrationNo: v.registrationNo } : {}),
        ...(v.email ? { email: v.email } : {}),
        ...(v.external ? { external: true } : {}),
        ...(v.external && v.clinic ? { clinic: v.clinic } : {}),
        active: v.active,
      }),
    {
      success: (_, v) =>
        doctor
          ? t('doctorUpdatedToast', { name: v.name })
          : t('doctorAddedToast', { name: v.name }),
      onSuccess: onClose,
    },
  )
  const submit = (ev?: React.BaseSyntheticEvent) =>
    void handleSubmit((v) => save.mutate(v), focusInvalid)(ev)

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={doctor ? t('editDoctorTitle') : t('addDoctorTitle')}
      description={t('doctorDialogBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <GuardedButton
            permission="masters.manage"
            variant="primary"
            loading={save.isPending}
            onClick={() => submit()}
          >
            {doctor ? tc('save') : t('addDoctor')}
          </GuardedButton>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
        <div className="empty:hidden sm:col-span-2">
          <FormErrorSummary
            count={
              formState.submitCount ? countFieldErrors(formState.errors) : 0
            }
            onFocusFirst={() => focusFirstInvalid()}
          />
        </div>
        <Field
          label={t('fieldDoctorName')}
          hint={t('fieldDoctorNameHint')}
          required
          error={err('name')}
          className="sm:col-span-2"
        >
          <Input {...register('name')} maxLength={80} autoComplete="off" />
        </Field>
        <Field label={t('fieldDepartment')} required error={err('department')}>
          <Controller
            control={control}
            name="department"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={CLINICAL_DEPARTMENTS.map((d) => ({
                  value: d,
                  label: e('clinicalDepartment', d),
                }))}
              />
            )}
          />
        </Field>
        <Field
          label={t('fieldSpecialty')}
          optionalLabel={tc('optional')}
          error={err('specialty')}
        >
          <Input {...register('specialty')} maxLength={80} />
        </Field>
        <Field
          label={t('fieldQualification')}
          optionalLabel={tc('optional')}
          hint={t('fieldQualificationHint')}
          error={err('qualification')}
        >
          <Input {...register('qualification')} maxLength={80} />
        </Field>
        <Field
          label={t('fieldRegistrationNo')}
          optionalLabel={tc('optional')}
          hint={t('fieldRegistrationNoHint')}
          error={err('registrationNo')}
        >
          <Input
            {...register('registrationNo')}
            maxLength={40}
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <Field label={t('fieldMobile')} required error={err('phone')}>
          <Input
            {...register('phone')}
            type="tel"
            inputMode="tel"
            maxLength={16}
            autoComplete="off"
            className="tabular-nums"
          />
        </Field>
        <Field
          label={t('fieldEmail')}
          optionalLabel={tc('optional')}
          error={err('email')}
        >
          <Input
            {...register('email')}
            type="email"
            maxLength={120}
            autoComplete="off"
          />
        </Field>
        <div className="grid gap-3 sm:col-span-2">
          <Controller
            control={control}
            name="external"
            render={({ field }) => (
              <SwitchRow
                id="doctor-external"
                label={t('fieldExternal')}
                hint={t('fieldExternalHint')}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          {external ? (
            <Field
              label={t('fieldClinic')}
              optionalLabel={tc('optional')}
              error={err('clinic')}
            >
              <Input {...register('clinic')} maxLength={120} />
            </Field>
          ) : null}
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <SwitchRow
                id="doctor-active"
                label={t('fieldDoctorActive')}
                hint={t('fieldDoctorActiveHint')}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </form>
    </Dialog>
  )
}
