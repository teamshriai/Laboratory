import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { isPinCode } from '@/domain/collection'
import { CENTRE_KINDS, type CollectionCentre } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { isLabApiError, labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useBillingMasters } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useNetworkFormText } from './form-text'
import { SwitchRow } from './switch-row'

/** Select value for "no credit account" (Radix Select has no empty value). */
const NO_ACCOUNT = 'none'
const CODE_TAKEN = 'network.codeTaken'
const MAX_TRANSIT = 24 * 60

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .regex(/^[A-Za-z0-9-]{2,12}$/, 'network.codeFormat'),
  name: z.string().trim().min(1, 'forms.required'),
  kind: z.enum(CENTRE_KINDS, { message: 'forms.selectOne' }),
  address: z.string().trim(),
  city: z.string().trim().min(1, 'forms.required'),
  pinCode: z.string().trim().refine(isPinCode, 'errors.invalid-pin'),
  phone: z.string().trim(),
  licenceNo: z.string().trim(),
  inchargeName: z.string().trim().min(1, 'network.inchargeRequired'),
  inchargeQualification: z.string().trim(),
  hours: z.string().trim(),
  transitMin: z
    .string()
    .trim()
    .refine(
      (v) => /^\d{1,4}$/.test(v) && Number(v) <= MAX_TRANSIT,
      'network.transitInvalid',
    ),
  coldChain: z.boolean(),
  accountId: z.string(),
  active: z.boolean(),
})

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

/** Adds a collection centre or edits one (NABL 111 details included). */
export function CentreDialog({
  centre,
  takenCodes,
  onClose,
}: {
  centre?: CollectionCentre | undefined
  /** Codes other centres already use. */
  takenCodes: string[]
  onClose: () => void
}) {
  const t = useT('network')
  const tc = useT('common')
  const e = useEnum()
  const text = useNetworkFormText()
  const { data: billing, isPending: accountsLoading } = useBillingMasters()
  const { register, control, handleSubmit, formState, setError } = useForm<
    FormIn,
    unknown,
    FormOut
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      code: centre?.code ?? '',
      name: centre?.name ?? '',
      kind: centre?.kind ?? 'own',
      address: centre?.address ?? '',
      city: centre?.city ?? '',
      pinCode: centre?.pinCode ?? '',
      phone: centre?.phone ?? '',
      licenceNo: centre?.licenceNo ?? '',
      inchargeName: centre?.inchargeName ?? '',
      inchargeQualification: centre?.inchargeQualification ?? '',
      hours: centre?.hours ?? '',
      transitMin: String(centre?.transitMin ?? 30),
      coldChain: centre?.coldChain ?? true,
      accountId: centre?.accountId ?? NO_ACCOUNT,
      active: centre?.active ?? true,
    },
  })
  const err = (k: keyof FormIn) => text(formState.errors[k]?.message)
  const accounts = (billing?.accounts ?? []).filter(
    (a) => a.active || a.id === centre?.accountId,
  )
  const save = useLabMutation(
    (v: FormOut) =>
      labApi.network.saveCentre({
        ...(centre ? { id: centre.id } : {}),
        code: v.code.toUpperCase(),
        name: v.name,
        kind: v.kind,
        address: v.address,
        city: v.city,
        pinCode: v.pinCode,
        phone: v.phone,
        ...(v.licenceNo ? { licenceNo: v.licenceNo } : {}),
        inchargeName: v.inchargeName,
        ...(v.inchargeQualification
          ? { inchargeQualification: v.inchargeQualification }
          : {}),
        hours: v.hours,
        transitMin: Number(v.transitMin),
        coldChain: v.coldChain,
        ...(v.accountId !== NO_ACCOUNT ? { accountId: v.accountId } : {}),
        active: v.active,
      }),
    {
      success: (_, v) =>
        centre
          ? t('centreUpdatedToast', { name: v.name })
          : t('centreAddedToast', { name: v.name }),
      onSuccess: onClose,
      onError: (error) => {
        if (isLabApiError(error) && error.code === 'duplicate-code') {
          setError('code', { message: CODE_TAKEN }, { shouldFocus: true })
        }
      },
    },
  )
  const submit = (ev?: React.BaseSyntheticEvent) =>
    void handleSubmit((v) => {
      if (takenCodes.includes(v.code.toUpperCase())) {
        setError('code', { message: CODE_TAKEN }, { shouldFocus: true })
        return
      }
      save.mutate(v)
    }, focusInvalid)(ev)

  return (
    <Dialog
      open
      size="xl"
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={centre ? t('editCentreTitle') : t('addCentreTitle')}
      description={t('centreDialogBody')}
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
            {centre ? tc('save') : t('addCentre')}
          </GuardedButton>
        </>
      }
    >
      <form className="grid gap-6" noValidate onSubmit={submit}>
        <div className="empty:hidden">
          <FormErrorSummary
            count={
              formState.submitCount ? countFieldErrors(formState.errors) : 0
            }
            onFocusFirst={() => focusFirstInvalid()}
          />
        </div>
        <Section title={t('sectionCentre')}>
          <Field
            label={t('fieldCode')}
            hint={t('fieldCodeHint')}
            required
            error={err('code')}
          >
            <Input
              {...register('code')}
              maxLength={12}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono uppercase"
            />
          </Field>
          <Field label={t('fieldKind')} required error={err('kind')}>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={CENTRE_KINDS.map((k) => ({
                    value: k,
                    label: e('centreKind', k),
                  }))}
                />
              )}
            />
          </Field>
          <Field
            label={t('fieldCentreName')}
            required
            error={err('name')}
            className="sm:col-span-2"
          >
            <Input {...register('name')} maxLength={100} autoComplete="off" />
          </Field>
          <Field
            label={t('fieldAddress')}
            optionalLabel={tc('optional')}
            error={err('address')}
            className="sm:col-span-2"
          >
            <Textarea {...register('address')} rows={2} maxLength={200} />
          </Field>
          <Field label={t('fieldCity')} required error={err('city')}>
            <Input {...register('city')} maxLength={60} />
          </Field>
          <Field label={t('fieldPin')} required error={err('pinCode')}>
            <Input
              {...register('pinCode')}
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
          <Field
            label={t('fieldPhone')}
            optionalLabel={tc('optional')}
            error={err('phone')}
          >
            <Input
              {...register('phone')}
              type="tel"
              inputMode="tel"
              maxLength={20}
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
          <Field
            label={t('fieldHours')}
            optionalLabel={tc('optional')}
            hint={t('fieldHoursHint')}
            error={err('hours')}
          >
            <Input {...register('hours')} maxLength={80} />
          </Field>
        </Section>

        <Section title={t('sectionCompliance')} hint={t('nablNote')}>
          <Field
            label={t('fieldLicence')}
            optionalLabel={tc('optional')}
            hint={t('fieldLicenceHint')}
            error={err('licenceNo')}
          >
            <Input
              {...register('licenceNo')}
              maxLength={40}
              autoComplete="off"
              className="font-mono"
            />
          </Field>
          <Field
            label={t('fieldTransit')}
            hint={t('fieldTransitHint')}
            required
            error={err('transitMin')}
          >
            <Input
              {...register('transitMin')}
              inputMode="numeric"
              maxLength={4}
              className="tabular-nums"
            />
          </Field>
          <Field
            label={t('fieldIncharge')}
            required
            error={err('inchargeName')}
          >
            <Input
              {...register('inchargeName')}
              maxLength={80}
              autoComplete="off"
            />
          </Field>
          <Field
            label={t('fieldInchargeQualification')}
            optionalLabel={tc('optional')}
            error={err('inchargeQualification')}
          >
            <Input {...register('inchargeQualification')} maxLength={80} />
          </Field>
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="coldChain"
              render={({ field }) => (
                <SwitchRow
                  id="centre-cold-chain"
                  label={t('fieldColdChain')}
                  hint={t('fieldColdChainHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </Section>

        <Section title={t('sectionBilling')}>
          <Field
            label={t('fieldAccount')}
            hint={t('fieldAccountHint')}
            error={err('accountId')}
            className="sm:col-span-2"
          >
            <Controller
              control={control}
              name="accountId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={accountsLoading}
                  options={[
                    { value: NO_ACCOUNT, label: t('noAccount') },
                    ...accounts.map((a) => ({
                      value: a.id,
                      label: a.name,
                      description: e('accountKind', a.kind),
                    })),
                  ]}
                />
              )}
            />
          </Field>
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <SwitchRow
                  id="centre-active"
                  label={t('fieldCentreActive')}
                  hint={t('fieldCentreActiveHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </Section>
      </form>
    </Dialog>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 border-b border-line pb-6 last:border-0 last:pb-0 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}
