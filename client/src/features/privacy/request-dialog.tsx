import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { istDay } from '@/domain/time'
import { DATA_REQUEST_KINDS } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { fromDateInput } from '@/lib/date-input'
import { labApi, type DataRequestInput } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { SigningAs } from '@/components/lab/signing-as'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { PatientPicker, type Picked } from './pickers'

const DAY = /^\d{4}-\d{2}-\d{2}$/

const schema = z.object({
  kind: z.enum(DATA_REQUEST_KINDS, { message: 'forms.selectOne' }),
  patientId: z.string(),
  requesterName: z.string().trim().min(1, 'forms.required').max(120),
  contact: z.string().trim().min(1, 'forms.required').max(120),
  details: z.string().trim().min(1, 'forms.required').max(2000),
  // Checked against today at submit time (never in the future).
  received: z
    .string()
    .regex(DAY, 'forms.invalidDate')
    .refine((d) => d <= istDay(Date.now()), 'forms.futureDate'),
})
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

/** Logs a data principal's request (DPDP Act 2023, sections 11 to 14). */
export function LogRequestDialog({
  open,
  onOpenChange,
  onLogged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogged: (id: string) => void
}) {
  if (!open) return null
  return <RequestForm onClose={() => onOpenChange(false)} onLogged={onLogged} />
}

function RequestForm({
  onClose,
  onLogged,
}: {
  onClose: () => void
  onLogged: (id: string) => void
}) {
  const t = useT('privacy')
  const tc = useT('common')
  const now = useNow()
  const today = istDay(now)
  const [patient, setPatient] = useState<Picked | null>(null)
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty, submitCount },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: undefined,
      patientId: '',
      requesterName: '',
      contact: '',
      details: '',
      received: today,
    },
  })
  const log = useLabMutation(
    (v: FormOut) => {
      const input: DataRequestInput = {
        kind: v.kind,
        ...(v.patientId ? { patientId: v.patientId } : {}),
        requesterName: v.requesterName,
        contact: v.contact,
        details: v.details,
        // A request logged on the day it arrived takes the current time.
        ...(v.received !== istDay(Date.now())
          ? { receivedAt: fromDateInput(v.received) }
          : {}),
      }
      return labApi.privacy.logRequest(input)
    },
    {
      success: () => t('requestLogged'),
      onSuccess: (id) => onLogged(id),
    },
  )
  const submit = () => void handleSubmit((v) => log.mutate(v), focusInvalid)()

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={isDirty || patient !== null}
      size="lg"
      title={t('logRequestTitle')}
      description={t('logRequestDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={log.isPending} onClick={submit}>
            {t('logRequest')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        aria-busy={log.isPending}
        className="grid gap-4 sm:grid-cols-2 [&>*]:content-start"
        onSubmit={(ev) => {
          ev.preventDefault()
          submit()
        }}
      >
        {submitCount ? (
          <div className="sm:col-span-2">
            <FormErrorSummary
              count={countFieldErrors(errors)}
              onFocusFirst={() => focusFirstInvalid()}
            />
          </div>
        ) : null}
        <Field label={t('fieldKind')} required error={errors.kind?.message}>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                placeholder={tc('selectPlaceholder')}
                options={DATA_REQUEST_KINDS.map((k) => ({
                  value: k,
                  label: t(`kind.${k}`),
                }))}
              />
            )}
          />
        </Field>
        <Field
          label={t('fieldReceived')}
          required
          error={errors.received?.message}
        >
          <Input type="date" max={today} {...register('received')} />
        </Field>
        <Field
          label={t('fieldPatient')}
          optionalLabel={tc('optional')}
          hint={t('patientHint')}
          className="sm:col-span-2"
        >
          <div>
            <PatientPicker
              value={patient}
              onChange={(p) => {
                setPatient(p)
                setValue('patientId', p?.id ?? '', { shouldDirty: true })
              }}
            />
          </div>
        </Field>
        <Field
          label={t('fieldRequester')}
          hint={t('requesterHint')}
          required
          error={errors.requesterName?.message}
        >
          <Input
            maxLength={120}
            autoComplete="off"
            {...register('requesterName')}
          />
        </Field>
        <Field
          label={t('fieldContact')}
          hint={t('contactHint')}
          required
          error={errors.contact?.message}
        >
          <Input maxLength={120} autoComplete="off" {...register('contact')} />
        </Field>
        <Field
          label={t('fieldDetails')}
          required
          error={errors.details?.message}
          className="sm:col-span-2"
        >
          <Textarea rows={4} maxLength={2000} {...register('details')} />
        </Field>
        <div className="sm:col-span-2">
          <SigningAs permission="privacy.manage" compact />
        </div>
      </form>
    </Dialog>
  )
}
