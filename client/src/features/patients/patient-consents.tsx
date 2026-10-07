import { zodResolver } from '@hookform/resolvers/zod'
import {
  CircleCheckIcon,
  CircleXIcon,
  PlusIcon,
  ShieldCheckIcon,
  Undo2Icon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import {
  CONSENT_METHODS,
  LANGUAGES,
  type ConsentPurpose,
  type Language,
} from '@/domain/types'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { LANGUAGE_NAMES } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi, type ConsentRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/toggles'
import { EmptyState } from '@/components/ui/states'

/** Purposes recorded here; consent for a test is taken at collection. */
const OTHER_PURPOSES = [
  'data-processing',
  'report-sharing',
  'research',
] as const satisfies readonly ConsentPurpose[]

const WITNESS_ERROR = 'witness'

const schema = z
  .object({
    purpose: z.enum(OTHER_PURPOSES),
    status: z.enum(['granted', 'refused']),
    method: z.enum(CONSENT_METHODS),
    language: z.enum(LANGUAGES),
    witness: z.string().trim().max(80, 'forms.tooLong'),
    notes: z.string().trim().max(500, 'forms.tooLong'),
  })
  .superRefine((v, ctx) => {
    if (v.method === 'verbal-witnessed' && !v.witness.includes(' '))
      ctx.addIssue({
        code: 'custom',
        path: ['witness'],
        message: WITNESS_ERROR,
      })
  })

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

export function ConsentStatusBadge({
  status,
}: {
  status: ConsentRow['status']
}) {
  const e = useEnum()
  const icon =
    status === 'granted' ? (
      <CircleCheckIcon aria-hidden />
    ) : status === 'refused' ? (
      <CircleXIcon aria-hidden />
    ) : (
      <Undo2Icon aria-hidden />
    )
  return (
    <Badge
      size="sm"
      tone={
        status === 'granted'
          ? 'success'
          : status === 'refused'
            ? 'warning'
            : 'neutral'
      }
    >
      {icon}
      {e('consentStatus', status)}
    </Badge>
  )
}

/** The patient's consents, with recording and withdrawal. */
export function ConsentsCard({
  patientId,
  consents,
  preferredLanguage,
  readOnly,
}: {
  patientId: string
  consents: ConsentRow[]
  preferredLanguage: Language | undefined
  readOnly: boolean
}) {
  const t = useT('patients')
  const [recording, setRecording] = useState(false)
  const [withdrawing, setWithdrawing] = useState<ConsentRow | null>(null)
  const action = readOnly ? null : (
    <GuardedButton
      permission="consent.record"
      size="sm"
      variant="secondary"
      onClick={() => setRecording(true)}
    >
      <PlusIcon strokeWidth={2.5} aria-hidden />
      {t('recordConsent')}
    </GuardedButton>
  )
  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<ShieldCheckIcon />}
        tone="green"
        title={t('consentsTitle')}
        description={t('consentsHint')}
        action={action}
      />
      {consents.length === 0 ? (
        <EmptyState
          compact
          icon={<ShieldCheckIcon />}
          tone="green"
          title={t('consentsEmpty')}
          description={t('consentsEmptyBody')}
          className="pb-6"
        />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {consents.map((c) => (
            <ConsentItem
              key={c.id}
              consent={c}
              readOnly={readOnly}
              onWithdraw={() => setWithdrawing(c)}
            />
          ))}
        </ul>
      )}
      {recording ? (
        <RecordConsentDialog
          patientId={patientId}
          preferredLanguage={preferredLanguage}
          onClose={() => setRecording(false)}
        />
      ) : null}
      {withdrawing ? (
        <WithdrawConsentDialog
          consent={withdrawing}
          onClose={() => setWithdrawing(null)}
        />
      ) : null}
    </Card>
  )
}

function ConsentItem({
  consent: c,
  readOnly,
  onWithdraw,
}: {
  consent: ConsentRow
  readOnly: boolean
  onWithdraw: () => void
}) {
  const t = useT('patients')
  const e = useEnum()
  const f = useFormat()
  const purpose = e('consentPurpose', c.purpose)
  return (
    <li className="grid gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{purpose}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {e('consentMethod', c.method)} · {LANGUAGE_NAMES[c.language]} ·{' '}
            {f.dateTime(c.at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConsentStatusBadge status={c.status} />
          {c.status === 'granted' && !readOnly ? (
            <GuardedButton
              permission="consent.record"
              size="sm"
              variant="ghost"
              aria-label={t('withdrawConsentFor', { purpose })}
              onClick={onWithdraw}
            >
              <Undo2Icon aria-hidden />
              {t('withdrawConsent')}
            </GuardedButton>
          ) : null}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-meta sm:grid-cols-2">
        <Fact label={t('consentRecordedBy')}>
          {t('consentRecordedByValue', {
            name: c.recordedByName,
            time: f.dateTime(c.recordedAt),
          })}
        </Fact>
        {c.witness ? (
          <Fact label={t('consentWitness')}>{c.witness}</Fact>
        ) : null}
        {c.testNames.length ? (
          <Fact label={t('consentTests')}>{c.testNames.join(', ')}</Fact>
        ) : null}
        {c.notes ? <Fact label={t('consentNotes')}>{c.notes}</Fact> : null}
      </dl>
      {c.status === 'withdrawn' ? (
        <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-meta text-fg">
          <Undo2Icon
            className="mt-0.5 size-4 shrink-0 text-fg-muted"
            aria-hidden
          />
          <span>
            {t('consentWithdrawnInfo', {
              time: c.withdrawnAt ? f.dateTime(c.withdrawnAt) : '-',
              name: c.withdrawnByName ?? '-',
            })}
            {c.withdrawReason ? (
              <span className="block text-fg-muted">
                {t('consentWithdrawReasonValue', { reason: c.withdrawReason })}
              </span>
            ) : null}
          </span>
        </p>
      ) : null}
    </li>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 break-words text-fg">{children}</dd>
    </div>
  )
}

function RecordConsentDialog({
  patientId,
  preferredLanguage,
  onClose,
}: {
  patientId: string
  preferredLanguage: Language | undefined
  onClose: () => void
}) {
  const t = useT('patients')
  const tc = useT('common')
  const e = useEnum()
  const { language } = useLanguage()
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      purpose: 'data-processing',
      status: 'granted',
      method: 'written',
      language: preferredLanguage ?? language,
      witness: '',
      notes: '',
    },
  })
  const { register, control, handleSubmit, formState } = form
  const method = useWatch({ control, name: 'method' })
  const err = (k: keyof FormIn) => {
    const m = formState.errors[k]?.message
    return m === WITNESS_ERROR ? t('consentWitnessInvalid') : m
  }
  const record = useLabMutation(
    (v: FormOut) =>
      labApi.patients.recordConsent(patientId, {
        purpose: v.purpose,
        status: v.status,
        method: v.method,
        language: v.language,
        at: Date.now(),
        ...(v.method === 'verbal-witnessed' && v.witness
          ? { witness: v.witness }
          : {}),
        ...(v.notes ? { notes: v.notes } : {}),
      }),
    {
      success: (_, v) =>
        v.status === 'granted'
          ? t('consentRecordedToast')
          : t('consentRefusalRecordedToast'),
      onSuccess: onClose,
    },
  )
  const submit = () =>
    void handleSubmit((v) => record.mutate(v), focusInvalid)()
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={t('recordConsentTitle')}
      description={t('recordConsentBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <GuardedButton
            permission="consent.record"
            variant="primary"
            loading={record.isPending}
            onClick={submit}
          >
            {t('recordConsent')}
          </GuardedButton>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        noValidate
        onSubmit={(ev) =>
          void handleSubmit((v) => record.mutate(v), focusInvalid)(ev)
        }
      >
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(formState.errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Field label={t('consentPurpose')} required className="sm:col-span-2">
          <Controller
            control={control}
            name="purpose"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={OTHER_PURPOSES.map((p) => ({
                  value: p,
                  label: e('consentPurpose', p),
                }))}
              />
            )}
          />
        </Field>
        <Field label={t('consentDecision')} required className="sm:col-span-2">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Segmented
                value={field.value}
                onValueChange={field.onChange}
                options={[
                  {
                    value: 'granted' as const,
                    label: t('consentDecisionGranted'),
                    icon: <CircleCheckIcon aria-hidden />,
                  },
                  {
                    value: 'refused' as const,
                    label: t('consentDecisionRefused'),
                    icon: <CircleXIcon aria-hidden />,
                  },
                ]}
                className="w-full [&>*]:flex-1 [&>*]:justify-center"
              />
            )}
          />
        </Field>
        <Field label={t('consentMethod')} required>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={CONSENT_METHODS.map((m) => ({
                  value: m,
                  label: e('consentMethod', m),
                }))}
              />
            )}
          />
        </Field>
        <Field label={t('consentLanguage')} required>
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={LANGUAGES.map((l) => ({
                  value: l,
                  label: LANGUAGE_NAMES[l],
                }))}
              />
            )}
          />
        </Field>
        {method === 'verbal-witnessed' ? (
          <Field
            label={t('consentWitness')}
            hint={t('consentWitnessHint')}
            required
            error={err('witness')}
            className="sm:col-span-2"
          >
            <Input {...register('witness')} autoComplete="off" />
          </Field>
        ) : null}
        <Field
          label={t('consentNotes')}
          optionalLabel={tc('optional')}
          error={err('notes')}
          className="sm:col-span-2"
        >
          <Textarea {...register('notes')} rows={2} maxLength={500} />
        </Field>
      </form>
    </Dialog>
  )
}

function WithdrawConsentDialog({
  consent,
  onClose,
}: {
  consent: ConsentRow
  onClose: () => void
}) {
  const t = useT('patients')
  const e = useEnum()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const withdraw = useLabMutation(
    (text: string) => labApi.patients.withdrawConsent(consent.id, text),
    { success: () => t('consentWithdrawnToast'), onSuccess: onClose },
  )
  const missing = !reason.trim()
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('withdrawConsentTitle')}
      description={t('withdrawConsentBody', {
        purpose: e('consentPurpose', consent.purpose),
      })}
      confirmLabel={t('withdrawConsent')}
      loading={withdraw.isPending}
      onConfirm={() => {
        setTried(true)
        if (missing) {
          window.setTimeout(() => focusFirstInvalid(), 0)
          return
        }
        withdraw.mutate(reason.trim())
      }}
    >
      <Field
        label={t('withdrawReason')}
        required
        error={tried && missing ? t('withdrawReasonRequired') : undefined}
      >
        <Textarea
          value={reason}
          rows={2}
          maxLength={300}
          placeholder={t('withdrawReasonPlaceholder')}
          onChange={(ev) => setReason(ev.target.value)}
        />
      </Field>
    </ConfirmDialog>
  )
}
