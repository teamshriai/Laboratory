import { zodResolver } from '@hookform/resolvers/zod'
import { InfoIcon } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { DAY, istDay } from '@/domain/time'
import { QC_LOT_STATUSES } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useInventoryMeta, useLots, useReagents } from '@/services/queries'
import { StockBadge } from '@/components/lab/status'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ChoiceCards } from '@/components/ui/toggles'
import { dateInputToMs, isFutureDateInput, roundQty } from './stock'
import { StorageLabel } from './stock-widgets'

const schema = z.object({
  reagentId: z.string().min(1, 'forms.selectOne'),
  lotNumber: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .max(40, 'forms.tooLong'),
  quantity: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .refine(
      (v) => Number.isFinite(Number(v)) && Number(v) > 0,
      'forms.positive',
    ),
  expiry: z
    .string()
    .min(1, 'forms.required')
    .refine(isFutureDateInput, 'forms.pastDate'),
  qcStatus: z.enum(QC_LOT_STATUSES),
  supplierId: z.string(),
  locationId: z.string().min(1, 'forms.selectOne'),
  received: z
    .string()
    .min(1, 'forms.required')
    .refine((v) => !isFutureDateInput(v), 'forms.futureDate'),
  note: z.string().max(300, 'forms.tooLong'),
})

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

/** Records a delivery of a reagent lot (new lot, or more of an existing one). */
export function ReceiveLotDialog({
  defaultReagentId,
  onClose,
}: {
  defaultReagentId?: string
  onClose: () => void
}) {
  const t = useT('inventory')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const { data: reagents } = useReagents()
  const { data: lots } = useLots({})
  const { data: meta } = useInventoryMeta()
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      reagentId: defaultReagentId ?? '',
      lotNumber: '',
      quantity: '',
      expiry: '',
      qcStatus: 'pending',
      supplierId: '',
      locationId: '',
      received: istDay(now),
      note: '',
    },
  })
  const { register, control, handleSubmit, formState } = form
  const [reagentId, lotNumber, qcStatus] = useWatch({
    control,
    name: ['reagentId', 'lotNumber', 'qcStatus'],
  })
  const reagent = reagents?.find((r) => r.id === reagentId)
  const existing = lots?.find(
    (l) => l.reagentId === reagentId && l.lotNumber === lotNumber.trim(),
  )

  const mutation = useLabMutation(
    (v: FormOut) =>
      labApi.inventory.receiveLot({
        reagentId: v.reagentId,
        lotNumber: v.lotNumber,
        quantity: Number(v.quantity),
        expiresAt: dateInputToMs(v.expiry),
        qcStatus: v.qcStatus,
        locationId: v.locationId,
        receivedAt: Math.min(dateInputToMs(v.received), now),
        ...(v.supplierId ? { supplierId: v.supplierId } : {}),
        ...(v.note.trim() ? { note: v.note.trim() } : {}),
      }),
    {
      success: (_, v) =>
        t('lotReceivedToast', {
          lot: v.lotNumber,
          reagent: reagents?.find((r) => r.id === v.reagentId)?.name ?? '',
        }),
      onSuccess: onClose,
    },
  )
  const submit = (v: FormOut) => mutation.mutate(v)

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t('receiveLotTitle')}
      description={t('receiveLotDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => void handleSubmit(submit)()}
          >
            {t('receiveConfirm')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(ev) => void handleSubmit(submit)(ev)}
        noValidate
      >
        <Field
          label={t('reagent')}
          required
          error={formState.errors.reagentId?.message}
          className="sm:col-span-2"
        >
          <Controller
            control={control}
            name="reagentId"
            render={({ field }) => (
              <Combobox
                value={field.value || undefined}
                onValueChange={field.onChange}
                placeholder={t('reagentPlaceholder')}
                searchPlaceholder={t('searchReagents')}
                emptyText={t('noReagentsMatch')}
                options={(reagents ?? [])
                  .toSorted((a, b) => a.name.localeCompare(b.name))
                  .map((r) => ({
                    value: r.id,
                    label: r.name,
                    description: `${r.manufacturer} · ${r.unit}`,
                    keywords: [r.manufacturer],
                    group: e('department', r.department),
                  }))}
              />
            )}
          />
        </Field>
        {reagent ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-meta sm:col-span-2">
            <StockBadge status={reagent.status} size="sm" />
            <span className="text-fg-muted">
              {t('usableNow')}{' '}
              <span className="font-semibold text-fg tabular-nums">
                {f.decimal(roundQty(reagent.totalUsable))} {reagent.unit}
              </span>
            </span>
            <span className="text-fg-muted">
              {t('reorderAt', {
                value: `${f.number(reagent.reorderLevel)} ${reagent.unit}`,
              })}
            </span>
            <StorageLabel storage={reagent.storage} className="text-fg-muted" />
          </div>
        ) : null}
        <Field
          label={t('lotNumber')}
          required
          error={formState.errors.lotNumber?.message}
          hint={
            existing
              ? t('existingLotHint', {
                  quantity: `${f.decimal(roundQty(existing.quantity))} ${existing.reagent.unit}`,
                })
              : undefined
          }
        >
          <Input
            {...register('lotNumber')}
            autoComplete="off"
            className="font-mono"
            placeholder="A2610-042"
          />
        </Field>
        <Field
          label={
            reagent ? t('quantityIn', { unit: reagent.unit }) : t('quantity')
          }
          required
          error={formState.errors.quantity?.message}
        >
          <Input
            {...register('quantity')}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            autoComplete="off"
            className="tabular-nums"
          />
        </Field>
        <Field
          label={t('expiryDate')}
          required
          error={formState.errors.expiry?.message}
        >
          <Input {...register('expiry')} type="date" min={istDay(now + DAY)} />
        </Field>
        <Field
          label={t('receivedDate')}
          required
          error={formState.errors.received?.message}
        >
          <Input {...register('received')} type="date" max={istDay(now)} />
        </Field>
        <Field label={t('supplier')} optionalLabel={tc('optional')}>
          <Controller
            control={control}
            name="supplierId"
            render={({ field }) => (
              <Select
                value={field.value || (reagent?.supplierId ?? '')}
                onValueChange={field.onChange}
                placeholder={t('supplierPlaceholder')}
                options={(meta?.suppliers ?? []).map((sp) => ({
                  value: sp.id,
                  label: sp.name,
                }))}
              />
            )}
          />
        </Field>
        <Field
          label={t('location')}
          required
          error={formState.errors.locationId?.message}
        >
          <Controller
            control={control}
            name="locationId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                placeholder={t('locationPlaceholder')}
                options={(meta?.locations ?? []).map((l) => ({
                  value: l.id,
                  label: l.name,
                }))}
              />
            )}
          />
        </Field>
        <Field label={t('qcStatus')} className="sm:col-span-2">
          <Controller
            control={control}
            name="qcStatus"
            render={({ field }) => (
              <ChoiceCards
                value={field.value}
                onValueChange={field.onChange}
                aria-label={t('qcStatus')}
                options={QC_LOT_STATUSES.map((s) => ({
                  value: s,
                  label: e('qcLotStatus', s),
                  description: t(`qcHint_${s}`),
                }))}
              />
            )}
          />
        </Field>
        {qcStatus === 'failed' ? (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-meta text-warning-text sm:col-span-2">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            {t('failedQcNotice')}
          </p>
        ) : null}
        <Field
          label={t('note')}
          optionalLabel={tc('optional')}
          error={formState.errors.note?.message}
          className="sm:col-span-2"
        >
          <Textarea
            {...register('note')}
            rows={2}
            maxLength={300}
            placeholder={t('receiveNotePlaceholder')}
          />
        </Field>
      </form>
    </Dialog>
  )
}
