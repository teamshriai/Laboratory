import { zodResolver } from '@hookform/resolvers/zod'
import {
  BuildingIcon,
  CreditCardIcon,
  BanknoteIcon,
  SmartphoneIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { PAYMENT_METHODS, type PaymentMethod } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi, type InvoiceDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useLabSettings } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ChoiceCards } from '@/components/ui/toggles'
import {
  needsReference,
  paise,
  parseAmount,
  refundable,
  TILL_METHODS,
  useMoney,
  type TillMethod,
} from './billing'
import { RecordOnlyNotice } from './record-only-notice'

const METHOD_ICONS: Record<PaymentMethod, ReactNode> = {
  cash: <BanknoteIcon />,
  card: <CreditCardIcon />,
  upi: <SmartphoneIcon />,
  credit: <BuildingIcon />,
}

const amountField = z
  .string()
  .trim()
  .min(1, 'forms.required')
  .refine((v) => (parseAmount(v) ?? 0) > 0, 'forms.positive')

function Summary({
  items,
}: {
  items: { label: string; value: string; strong?: boolean }[]
}) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="min-w-0 bg-surface-2/60 px-3.5 py-2.5">
          <dt className="text-xs text-fg-muted">{i.label}</dt>
          <dd
            className={
              i.strong
                ? 'mt-0.5 text-base font-semibold text-fg tabular-nums'
                : 'mt-0.5 text-sm font-medium text-fg tabular-nums'
            }
          >
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// ---------- Record payment ----------

const paymentSchema = z
  .object({
    method: z.enum(PAYMENT_METHODS, { error: 'forms.selectOne' }),
    amount: amountField,
    reference: z.string().trim().max(60, 'forms.invalid'),
  })
  .superRefine((v, ctx) => {
    if (needsReference(v.method) && !v.reference)
      ctx.addIssue({
        code: 'custom',
        path: ['reference'],
        message: 'errors.reference-required',
      })
  })

/** Records a payment the desk received (nothing is charged from here). */
export function PaymentDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceDetail
  onClose: () => void
}) {
  const t = useT('billing')
  const tc = useT('common')
  const e = useEnum()
  const money = useMoney()
  const balance = invoice.totals.balance
  const methods = PAYMENT_METHODS.filter(
    (m) => m !== 'credit' || Boolean(invoice.accountName),
  )
  const form = useForm<
    z.input<typeof paymentSchema>,
    unknown,
    z.output<typeof paymentSchema>
  >({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      method: invoice.accountName ? 'credit' : 'cash',
      amount: balance.toFixed(2),
      reference: '',
    },
  })
  const { register, control, handleSubmit, formState, setError } = form
  const method = useWatch({ control, name: 'method' })
  const mutation = useLabMutation(
    (input: { method: PaymentMethod; amount: number; reference?: string }) =>
      labApi.billing.pay(invoice.id, input),
    {
      success: (_, v) =>
        t('paymentRecorded', {
          amount: money(v.amount),
          invoice: invoice.invoiceNo,
        }),
      onSuccess: onClose,
    },
  )
  const submit = (v: z.output<typeof paymentSchema>) => {
    const amount = parseAmount(v.amount) ?? 0
    if (amount > balance) {
      setError('amount', {
        message: t('amountOverBalance', { balance: money(balance) }),
      })
      return
    }
    mutation.mutate({
      method: v.method,
      amount,
      ...(v.reference ? { reference: v.reference } : {}),
    })
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={t('paymentTitle')}
      description={t('paymentDescription', { invoice: invoice.invoiceNo })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            {t('recordPayment')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <RecordOnlyNotice />
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(formState.errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Summary
          items={[
            { label: t('total'), value: money(invoice.totals.total) },
            { label: t('paidToDate'), value: money(invoice.totals.paid) },
            { label: t('balance'), value: money(balance), strong: true },
          ]}
        />
        <Field
          label={t('method')}
          required
          error={formState.errors.method?.message}
        >
          <div>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <ChoiceCards
                  aria-label={t('method')}
                  columns={2}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={methods.map((m) => ({
                    value: m,
                    label: e('paymentMethod', m),
                    icon: METHOD_ICONS[m],
                    ...(m === 'credit' && invoice.accountName
                      ? { description: invoice.accountName }
                      : {}),
                  }))}
                />
              )}
            />
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('amount')}
            required
            error={formState.errors.amount?.message}
          >
            <Input
              {...register('amount')}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
          <Field
            label={t('reference')}
            required={needsReference(method)}
            optionalLabel={needsReference(method) ? undefined : tc('optional')}
            hint={
              method === 'upi'
                ? t('referenceUpiHint')
                : method === 'card'
                  ? t('referenceCardHint')
                  : undefined
            }
            error={formState.errors.reference?.message}
          >
            <Input
              {...register('reference')}
              autoComplete="off"
              maxLength={60}
            />
          </Field>
        </div>
      </form>
    </Dialog>
  )
}

// ---------- Refund ----------

const refundSchema = z.object({
  method: z.enum(TILL_METHODS, { error: 'forms.selectOne' }),
  amount: amountField,
  reason: z
    .string()
    .trim()
    .min(1, 'forms.reasonRequired')
    .max(300, 'forms.invalid'),
})

export function RefundDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceDetail
  onClose: () => void
}) {
  const t = useT('billing')
  const tc = useT('common')
  const e = useEnum()
  const money = useMoney()
  const max = refundable(invoice)
  const lastMethod = invoice.payments
    .filter((p) => p.method !== 'credit')
    .at(-1)?.method as TillMethod | undefined
  const form = useForm<
    z.input<typeof refundSchema>,
    unknown,
    z.output<typeof refundSchema>
  >({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      method: lastMethod ?? 'cash',
      amount: max.toFixed(2),
      reason: '',
    },
  })
  const { register, control, handleSubmit, formState, setError } = form
  const mutation = useLabMutation(
    (input: { method: TillMethod; amount: number; reason: string }) =>
      labApi.billing.refund(invoice.id, input),
    {
      success: (_, v) =>
        t('refundRecorded', {
          amount: money(v.amount),
          invoice: invoice.invoiceNo,
        }),
      onSuccess: onClose,
    },
  )
  const submit = (v: z.output<typeof refundSchema>) => {
    const amount = parseAmount(v.amount) ?? 0
    if (amount > max) {
      setError('amount', {
        message: t('amountOverRefundable', { amount: money(max) }),
      })
      return
    }
    mutation.mutate({ method: v.method, amount, reason: v.reason })
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={t('refundTitle')}
      description={t('refundDescription', { invoice: invoice.invoiceNo })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            {t('recordRefund')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <RecordOnlyNotice />
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(formState.errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Summary
          items={[
            { label: t('paidToDate'), value: money(invoice.totals.paid) },
            {
              label: t('refunded'),
              value: money(invoice.totals.refunded),
            },
            { label: t('refundable'), value: money(max), strong: true },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('amount')}
            required
            error={formState.errors.amount?.message}
          >
            <Input
              {...register('amount')}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
          <Field
            label={t('refundMethod')}
            required
            error={formState.errors.method?.message}
          >
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={TILL_METHODS.map((m) => ({
                    value: m,
                    label: e('paymentMethod', m),
                  }))}
                />
              )}
            />
          </Field>
        </div>
        <Field
          label={t('reason')}
          required
          error={formState.errors.reason?.message}
        >
          <Textarea {...register('reason')} rows={3} maxLength={300} />
        </Field>
      </form>
    </Dialog>
  )
}

// ---------- Discount ----------

const discountSchema = z.object({
  amount: amountField,
  reason: z
    .string()
    .trim()
    .min(1, 'forms.reasonRequired')
    .max(300, 'forms.invalid'),
})

/**
 * Asks for a discount. Within the lab's limit it applies at once; above it,
 * it waits for someone who may authorise discounts.
 */
export function DiscountDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceDetail
  onClose: () => void
}) {
  const t = useT('billing')
  const tc = useT('common')
  const money = useMoney()
  const { data: settings } = useLabSettings()
  const gross = invoice.totals.gross
  const pct = settings?.billing.discountApprovalPct
  const form = useForm<
    z.input<typeof discountSchema>,
    unknown,
    z.output<typeof discountSchema>
  >({
    resolver: zodResolver(discountSchema),
    defaultValues: { amount: '', reason: '' },
  })
  const { register, handleSubmit, formState, setError } = form
  const mutation = useLabMutation(
    (input: { amount: number; reason: string }) =>
      labApi.billing.requestDiscount(invoice.id, input),
    {
      success: (r, v) =>
        r.approved
          ? t('discountApplied', { amount: money(v.amount) })
          : t('discountRequested', { amount: money(v.amount) }),
      onSuccess: onClose,
    },
  )
  const submit = (v: z.output<typeof discountSchema>) => {
    const amount = parseAmount(v.amount) ?? 0
    if (amount > gross) {
      setError('amount', {
        message: t('discountOverGross', { amount: money(gross) }),
      })
      return
    }
    mutation.mutate({ amount, reason: v.reason })
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={t('discountTitle')}
      description={t('discountDescription', { invoice: invoice.invoiceNo })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            {t('discountSubmit')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(formState.errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        {pct !== undefined ? (
          <p className="rounded-lg bg-surface-2 px-3.5 py-3 text-meta text-fg-muted">
            {t('discountLimitHint', {
              pct,
              amount: money(paise((gross * pct) / 100)),
            })}
          </p>
        ) : null}
        <Field
          label={t('discountAmount')}
          required
          hint={t('discountAmountHint', { amount: money(gross) })}
          error={formState.errors.amount?.message}
        >
          <Input
            {...register('amount')}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            className="tabular-nums"
          />
        </Field>
        <Field
          label={t('reason')}
          required
          error={formState.errors.reason?.message}
        >
          <Textarea {...register('reason')} rows={3} maxLength={300} />
        </Field>
      </form>
    </Dialog>
  )
}
