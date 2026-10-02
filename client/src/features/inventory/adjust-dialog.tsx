import { zodResolver } from '@hookform/resolvers/zod'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { ADJUST_REASONS, type AdjustReason } from '@/domain/types'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { isLabApiError, labApi } from '@/services/lab-api'
import { errorMessage, useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/toggles'
import { roundQty, useSignedQty } from './stock'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'

const schema = z
  .object({
    direction: z.enum(['remove', 'add']),
    amount: z
      .string()
      .trim()
      .min(1, 'forms.required')
      .refine(
        (v) => Number.isFinite(Number(v)) && Number(v) > 0,
        'forms.positive',
      ),
    reason: z.enum(ADJUST_REASONS, { error: 'forms.reasonRequired' }),
    note: z.string().max(300, 'forms.tooLong'),
  })
  .superRefine((v, ctx) => {
    if (v.reason === 'other' && !v.note.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'forms.remarksRequired',
      })
  })

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

export interface AdjustTarget {
  kind: 'lot' | 'consumable'
  id: string
  /** Shown in the title and the toast, e.g. "Glucose HK Gen.3, lot 721804". */
  name: string
  quantity: number
  unit: string
}

/** Corrects a lot or consumable quantity with a signed change and a reason. */
export function AdjustStockDialog({
  target,
  onClose,
}: {
  target: AdjustTarget
  onClose: () => void
}) {
  const t = useT('inventory')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const { language } = useLanguage()
  const signed = useSignedQty()
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: { direction: 'remove', amount: '', note: '' },
  })
  const { register, control, handleSubmit, formState, setError } = form
  const [direction, amount, reason] = useWatch({
    control,
    name: ['direction', 'amount', 'reason'],
  })

  const mutation = useLabMutation(
    (input: { delta: number; reason: AdjustReason; note?: string }) =>
      target.kind === 'lot'
        ? labApi.inventory.adjustLot(target.id, input)
        : labApi.inventory.adjustConsumable(target.id, input),
    {
      success: (_, v) =>
        t('adjustedToast', {
          item: target.name,
          change: signed(v.delta, target.unit),
        }),
      onSuccess: onClose,
      onError: (error) => {
        if (isLabApiError(error) && error.code === 'insufficient-stock')
          setError('amount', { message: errorMessage(error, language) })
      },
    },
  )

  const parsed = Number(amount)
  const delta =
    Number.isFinite(parsed) && parsed > 0
      ? direction === 'add'
        ? parsed
        : -parsed
      : 0
  const after = roundQty(target.quantity + delta)

  const submit = (v: FormOut) => {
    const value = Number(v.amount)
    if (v.direction === 'remove' && value > target.quantity) {
      setError('amount', {
        message: t('insufficientStock', {
          available: `${f.decimal(roundQty(target.quantity))} ${target.unit}`,
        }),
      })
      return
    }
    const note = v.note.trim()
    mutation.mutate({
      delta: v.direction === 'add' ? value : -value,
      reason: v.reason,
      ...(note ? { note } : {}),
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty && !formState.isSubmitSuccessful}
      title={t('adjustTitle')}
      description={target.name}
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
            {t('adjustConfirm')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
        noValidate
      >
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(formState.errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
          <div className="bg-surface-2/60 px-4 py-3">
            <p className="text-xs text-fg-muted">{t('currentQuantity')}</p>
            <p className="mt-0.5 text-lg font-semibold text-fg tabular-nums">
              {f.decimal(roundQty(target.quantity))}{' '}
              <span className="text-xs font-medium text-fg-muted">
                {target.unit}
              </span>
            </p>
          </div>
          <div className="bg-surface-2/60 px-4 py-3">
            <p className="text-xs text-fg-muted">{t('afterAdjustment')}</p>
            <p
              className={cn(
                'mt-0.5 text-lg font-semibold tabular-nums',
                after < 0 ? 'text-danger-text' : 'text-fg',
              )}
            >
              {f.decimal(after)}{' '}
              <span className="text-xs font-medium text-fg-muted">
                {target.unit}
              </span>
              {delta !== 0 ? (
                <span
                  className={cn(
                    'ml-2 text-xs font-semibold',
                    delta > 0 ? 'text-success-text' : 'text-fg-muted',
                  )}
                >
                  {signed(delta, target.unit)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('direction')}>
            <Controller
              control={control}
              name="direction"
              render={({ field }) => (
                <Segmented
                  value={field.value}
                  onValueChange={field.onChange}
                  aria-label={t('direction')}
                  className="w-full [&>*]:flex-1 [&>*]:justify-center"
                  options={[
                    {
                      value: 'remove',
                      label: t('directionRemove'),
                      icon: <MinusIcon />,
                    },
                    {
                      value: 'add',
                      label: t('directionAdd'),
                      icon: <PlusIcon />,
                    },
                  ]}
                />
              )}
            />
          </Field>
          <Field
            label={t('amountIn', { unit: target.unit })}
            required
            error={formState.errors.amount?.message}
          >
            <Input
              {...register('amount')}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              autoComplete="off"
              autoFocus
              className="tabular-nums"
            />
          </Field>
        </div>
        <Field
          label={t('reason')}
          required
          error={formState.errors.reason?.message}
        >
          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                placeholder={tc('selectPlaceholder')}
                options={ADJUST_REASONS.map((r) => ({
                  value: r,
                  label: e('adjustReason', r),
                }))}
              />
            )}
          />
        </Field>
        <Field
          label={t('note')}
          required={reason === 'other'}
          optionalLabel={reason === 'other' ? undefined : tc('optional')}
          error={formState.errors.note?.message}
        >
          <Textarea
            {...register('note')}
            rows={2}
            maxLength={300}
            placeholder={t('adjustNotePlaceholder')}
          />
        </Field>
      </form>
    </Dialog>
  )
}
