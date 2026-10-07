import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { fromDateTimeInput, toDateTimeInput } from '@/lib/date-input'
import { labApi, type BreachInput } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { SigningAs } from '@/components/lab/signing-as'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const schema = z.object({
  title: z.string().trim().min(1, 'forms.required').max(200),
  description: z.string().trim().min(1, 'forms.required').max(2000),
  // When it was noticed: the CERT-In and Board clocks start here.
  detected: z
    .string()
    .regex(DATE_TIME, 'forms.invalidDate')
    .refine((v) => fromDateTimeInput(v) <= Date.now(), 'forms.futureTime'),
  affectedCount: z
    .string()
    .trim()
    .regex(/^\d{1,9}$/, 'forms.invalidNumber')
    .transform(Number),
  dataKinds: z.string().trim().min(1, 'forms.required').max(300),
})
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

/** Logs a personal-data breach or cyber incident. */
export function LogIncidentDialog({
  open,
  onOpenChange,
  onLogged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogged: (id: string) => void
}) {
  if (!open) return null
  return (
    <IncidentForm onClose={() => onOpenChange(false)} onLogged={onLogged} />
  )
}

function IncidentForm({
  onClose,
  onLogged,
}: {
  onClose: () => void
  onLogged: (id: string) => void
}) {
  const t = useT('privacy')
  const tc = useT('common')
  const now = useNow()
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, submitCount },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      detected: toDateTimeInput(now),
      affectedCount: '',
      dataKinds: '',
    },
  })
  const log = useLabMutation(
    (v: FormOut) => {
      const input: BreachInput = {
        title: v.title,
        description: v.description,
        detectedAt: Math.min(fromDateTimeInput(v.detected), Date.now()),
        affectedCount: v.affectedCount,
        dataKinds: v.dataKinds,
      }
      return labApi.privacy.logBreach(input)
    },
    {
      success: () => t('incidentLogged'),
      onSuccess: (id) => onLogged(id),
    },
  )
  const submit = () => void handleSubmit((v) => log.mutate(v), focusInvalid)()

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={isDirty}
      size="lg"
      title={t('logIncidentTitle')}
      description={t('logIncidentDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={log.isPending} onClick={submit}>
            {t('logIncident')}
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
        <Field
          label={t('fieldTitle')}
          required
          error={errors.title?.message}
          className="sm:col-span-2"
        >
          <Input maxLength={200} autoComplete="off" {...register('title')} />
        </Field>
        <Field
          label={t('fieldDetected')}
          hint={t('detectedHint')}
          required
          error={errors.detected?.message}
        >
          <Input
            type="datetime-local"
            max={toDateTimeInput(now)}
            {...register('detected')}
          />
        </Field>
        <Field
          label={t('fieldAffected')}
          hint={t('affectedHint')}
          required
          error={errors.affectedCount?.message}
        >
          <Input
            inputMode="numeric"
            maxLength={9}
            autoComplete="off"
            {...register('affectedCount')}
          />
        </Field>
        <Field
          label={t('fieldDataKinds')}
          hint={t('dataKindsHint')}
          required
          error={errors.dataKinds?.message}
          className="sm:col-span-2"
        >
          <Input
            maxLength={300}
            autoComplete="off"
            {...register('dataKinds')}
          />
        </Field>
        <Field
          label={t('fieldDescription')}
          required
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <Textarea rows={4} maxLength={2000} {...register('description')} />
        </Field>
        <div className="sm:col-span-2">
          <SigningAs permission="privacy.manage" compact />
        </div>
      </form>
    </Dialog>
  )
}
