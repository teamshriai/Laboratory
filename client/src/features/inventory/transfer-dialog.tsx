import { ArrowLeftRightIcon } from 'lucide-react'
import { useState } from 'react'
import { useT } from '@/i18n/context'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useInventoryMeta } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export interface TransferTarget {
  kind: 'lot' | 'consumable'
  id: string
  name: string
  quantity: number
  unit: string
  locationId?: string
}

export function TransferDialog({
  target,
  onClose,
}: {
  target: TransferTarget
  onClose: () => void
}) {
  const t = useT('inventory')
  const tc = useT('common')
  const tf = useT('forms')
  const { data: meta } = useInventoryMeta()
  const [to, setTo] = useState('')
  const [qty, setQty] = useState(String(target.quantity))
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const amount = Number(qty)
  const qtyError =
    !Number.isFinite(amount) || amount <= 0
      ? tf('positive')
      : amount > target.quantity
        ? t('insufficientStock', {
            available: `${target.quantity} ${target.unit}`,
          })
        : undefined
  const locations = (meta?.locations ?? []).filter(
    (l) => l.id !== target.locationId,
  )
  const from = meta?.locations.find((l) => l.id === target.locationId)
  const move = useLabMutation(
    () =>
      labApi.inventory.transfer({
        kind: target.kind,
        id: target.id,
        toLocationId: to,
        quantity: amount,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    {
      success: () =>
        t('transferredToast', {
          quantity: `${amount} ${target.unit}`,
          location: meta?.locations.find((l) => l.id === to)?.name ?? '',
        }),
      onSuccess: onClose,
    },
  )
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('transferTitle')}
      description={target.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={move.isPending}
            onClick={() => {
              setTouched(true)
              if (!to || qtyError) return
              move.mutate()
            }}
          >
            <ArrowLeftRightIcon />
            {t('transferConfirm')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('transferFrom')}>
          <Input value={from?.name ?? t('unknownLocation')} readOnly disabled />
        </Field>
        <Field
          label={t('transferTo')}
          required
          error={touched && !to ? tf('selectOne') : undefined}
        >
          <Select
            value={to}
            onValueChange={setTo}
            placeholder={t('locationPlaceholder')}
            options={locations.map((l) => ({ value: l.id, label: l.name }))}
          />
        </Field>
        <Field
          label={t('transferQuantity', { unit: target.unit })}
          required
          error={touched ? qtyError : undefined}
          hint={target.kind === 'lot' ? t('transferHintPartial') : undefined}
          className="sm:col-span-2"
        >
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={target.quantity}
            step="any"
            value={qty}
            onChange={(ev) => setQty(ev.target.value)}
            className="tabular-nums"
          />
        </Field>
        <Field
          label={t('note')}
          optionalLabel={tc('optional')}
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            maxLength={300}
          />
        </Field>
      </div>
    </Dialog>
  )
}
